import { createHash } from "node:crypto";

import type { DatabaseConnection } from "@/lib/db/client";
import { getDatabase } from "@/lib/db/client";
import {
  driveFolderExistsForUser,
  ensureDriveFolderForUser,
  ensureDriveRootFolder,
} from "@/lib/google/drive";
import { getOfferingGoogleIntegration } from "@/lib/google/offering-integrations";
import type { GoogleFetch } from "@/lib/google/oauth";
import {
  buildOfferingStoragePath,
  getOfferingStorageContextById,
  getStorageLayout,
} from "@/lib/storage-layout";
import { isAdmin } from "./access";
import type { Actor } from "./actor";
import { recordAdminAction } from "./audit";
import type { V2Database } from "./database";
import { storageOwnerStatus } from "./drive-storage";

export function driveFolderCoverage(
  connection: DatabaseConnection = getDatabase(),
) {
  const row = connection.sqlite
    .prepare(
      `SELECT count(*) total,
              count(ogi.drive_folder_id) configured
       FROM subject_offerings so
       LEFT JOIN offering_google_integrations ogi ON ogi.offering_id=so.id
       WHERE so.status <> 'cancelled'`,
    )
    .get() as { total: number; configured: number };
  return row;
}

export async function provisionPendingDriveFolders(
  db: V2Database,
  actor: Actor,
  options: {
    connection?: DatabaseConnection;
    fetchImpl?: GoogleFetch;
  } = {},
) {
  if (!isAdmin(db, actor))
    throw new Error("Somente Admin pode preparar pastas Drive.");
  const storage = storageOwnerStatus(db);
  if (!storage?.connected || !storage.ownerId)
    throw new Error("Conecte um proprietário do Drive central primeiro.");
  const ownerLink = db
    .prepare("SELECT legacy_user_id id FROM legacy_user_links WHERE user_id=?")
    .get(storage.ownerId) as { id: number } | undefined;
  if (!ownerLink)
    throw new Error("O proprietário do Drive precisa entrar no Hub primeiro.");

  const connection = options.connection ?? getDatabase();
  const fetchImpl = options.fetchImpl ?? fetch;
  const offerings = (
    connection.sqlite
      .prepare(
        `SELECT so.id FROM subject_offerings so
         WHERE so.status <> 'cancelled'
         ORDER BY so.id`,
      )
      .all() as Array<{ id: number }>
  ).map(({ id }) => id);
  if (!offerings.length) return { checked: 0, created: 0, remaining: 0 };

  const root = await ensureDriveRootFolder(ownerLink.id, {
    connection,
    fetchImpl,
  });
  const layout = getStorageLayout(connection);
  let created = 0;
  for (const offeringId of offerings) {
    const existingId = getOfferingGoogleIntegration(
      offeringId,
      connection,
    )?.driveFolderId;
    if (
      existingId &&
      (await driveFolderExistsForUser(ownerLink.id, existingId, {
        connection,
        fetchImpl,
      }))
    )
      continue;
    let parentId = root.id;
    let folder = root;
    for (const name of buildOfferingStoragePath(
      layout,
      getOfferingStorageContextById(offeringId, connection),
    )) {
      const identity = createHash("sha256")
        .update(`${parentId}\0${name}`)
        .digest("hex")
        .slice(0, 40);
      folder = await ensureDriveFolderForUser(
        ownerLink.id,
        {
          name,
          parentId,
          identityKey: `academic-path:${identity}`,
        },
        { connection, fetchImpl },
      );
      parentId = folder.id;
    }
    connection.sqlite
      .prepare(
        `INSERT INTO offering_google_integrations
         (offering_id,drive_folder_id,drive_folder_name,drive_storage_user_id,updated_at)
         VALUES(?,?,?,?,?)
         ON CONFLICT(offering_id) DO UPDATE SET
           drive_folder_id=excluded.drive_folder_id,
           drive_folder_name=excluded.drive_folder_name,
           drive_storage_user_id=excluded.drive_storage_user_id,
           updated_by_user_id=NULL,
           updated_at=excluded.updated_at`,
      )
      .run(offeringId, folder.id, folder.name, ownerLink.id, Date.now());
    recordAdminAction(
      db,
      actor,
      "storage.offering_folder_create",
      "offering",
      offeringId,
    );
    created += 1;
  }
  const coverage = driveFolderCoverage(connection);
  db.prepare(
    "UPDATE google_automation_v2 SET drive_status='pending',last_drive_check_at=NULL WHERE id=1",
  ).run();
  return {
    checked: offerings.length,
    created,
    remaining: coverage.total - coverage.configured,
  };
}
