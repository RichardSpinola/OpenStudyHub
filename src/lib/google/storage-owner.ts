import { z } from "zod";

import { recordAuditEvent } from "@/lib/audit";
import type { DatabaseConnection } from "@/lib/db/client";
import { getDatabase } from "@/lib/db/client";

const STORAGE_OWNER_KEY = "google.storage_owner_user_id";
const idSchema = z.number().int().positive();

export type DriveStorageOwnerCandidate = {
  userId: number;
  displayName: string;
  accountEmail: string | null;
};

export function getConfiguredDriveStorageOwnerId(
  connection: DatabaseConnection = getDatabase(),
): number | null {
  const row = connection.sqlite
    .prepare("select value from app_settings where key = ?")
    .get(STORAGE_OWNER_KEY) as { value: string } | undefined;
  if (!row) return null;
  const parsed = idSchema.safeParse(Number(row.value));
  if (!parsed.success) {
    throw new Error("Central Drive configuration is invalid.");
  }
  return parsed.data;
}

export function listDriveStorageOwnerCandidates(
  connection: DatabaseConnection = getDatabase(),
): DriveStorageOwnerCandidate[] {
  return connection.sqlite
    .prepare(
      `select u.id as userId, u.display_name as displayName,
              gc.account_email as accountEmail
       from users u
       join google_connections gc on gc.user_id = u.id
       where u.active = 1 and gc.status = 'connected'
         and gc.encrypted_refresh_token is not null
       order by u.display_name collate nocase, u.id`,
    )
    .all() as DriveStorageOwnerCandidate[];
}

export function isConfiguredDriveStorageAvailable(
  connection: DatabaseConnection = getDatabase(),
): boolean {
  const ownerId = getConfiguredDriveStorageOwnerId(connection);
  if (ownerId === null) return false;
  return Boolean(
    connection.sqlite
      .prepare(
        `select 1
         from users u
         join google_connections gc on gc.user_id = u.id
         where u.id = ? and u.active = 1 and gc.status = 'connected'
           and gc.encrypted_refresh_token is not null`,
      )
      .get(ownerId),
  );
}

export function setDriveStorageOwner(
  actorUserId: number,
  storageOwnerUserId: number | null,
  connection: DatabaseConnection = getDatabase(),
): void {
  const actorId = idSchema.parse(actorUserId);
  const actor = connection.sqlite
    .prepare("select role from users where id = ? and active = 1")
    .get(actorId) as { role: string } | undefined;
  if (actor?.role !== "admin") throw new Error("Admin access required.");

  const ownerId =
    storageOwnerUserId === null ? null : idSchema.parse(storageOwnerUserId);
  if (ownerId !== null) {
    const candidate = connection.sqlite
      .prepare(
        `select 1
         from users u
         join google_connections gc on gc.user_id = u.id
         where u.id = ? and u.active = 1 and gc.status = 'connected'
           and gc.encrypted_refresh_token is not null`,
      )
      .get(ownerId);
    if (!candidate) {
      throw new Error("Storage owner must be an active connected user.");
    }
  }

  connection.sqlite.transaction(() => {
    if (ownerId === null) {
      connection.sqlite
        .prepare("delete from app_settings where key = ?")
        .run(STORAGE_OWNER_KEY);
    } else {
      connection.sqlite
        .prepare(
          `insert into app_settings (key, value, updated_at) values (?, ?, ?)
           on conflict(key) do update set value = excluded.value,
             updated_at = excluded.updated_at`,
        )
        .run(STORAGE_OWNER_KEY, String(ownerId), Date.now());
    }
    recordAuditEvent(
      {
        actorUserId: actorId,
        action: "settings.google_storage_owner_update",
        targetType: "app_setting",
        targetId: STORAGE_OWNER_KEY,
        summary:
          ownerId === null
            ? "Central Drive storage disabled"
            : "Central Drive storage owner updated",
      },
      connection,
    );
  })();
}

export function resolveDriveStorageUser(
  resourceOwnerUserId: number,
  resourceStorageUserId: number | null | undefined,
  options: {
    connection?: DatabaseConnection;
    useConfiguredForNew?: boolean;
  } = {},
): number {
  const resourceOwnerId = idSchema.parse(resourceOwnerUserId);
  if (resourceStorageUserId !== null && resourceStorageUserId !== undefined) {
    return idSchema.parse(resourceStorageUserId);
  }
  if (options.useConfiguredForNew === false) return resourceOwnerId;
  return (
    getConfiguredDriveStorageOwnerId(options.connection ?? getDatabase()) ??
    resourceOwnerId
  );
}
