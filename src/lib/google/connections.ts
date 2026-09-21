import { z } from "zod";

import { recordAuditEvent } from "@/lib/audit";
import type { DatabaseConnection } from "@/lib/db/client";
import { getDatabase } from "@/lib/db/client";

import { decryptSecret, encryptSecret } from "./crypto";

const idSchema = z.number().int().positive();
const connectionInputSchema = z.object({
  googleSubject: z.string().trim().min(1).max(255),
  accountEmail: z.email().max(320),
  refreshToken: z.string().min(1).max(8192),
  grantedScopes: z.array(z.string().trim().min(1).max(255)).min(1).max(30),
});

export type GoogleConnectionSummary = {
  userId: number;
  accountEmail: string | null;
  grantedScopes: string[];
  status: "connected" | "revoked";
  driveRootFolderId: string | null;
  connectedAt: number;
  updatedAt: number;
};

export function getGoogleConnection(
  userId: number,
  connection: DatabaseConnection = getDatabase(),
): GoogleConnectionSummary | null {
  const row = connection.sqlite
    .prepare(
      `select user_id as userId, account_email as accountEmail,
              granted_scopes as grantedScopes, status,
              drive_root_folder_id as driveRootFolderId,
              connected_at as connectedAt, updated_at as updatedAt
       from google_connections where user_id = ?`,
    )
    .get(idSchema.parse(userId)) as
    | (Omit<GoogleConnectionSummary, "grantedScopes"> & {
        grantedScopes: string;
      })
    | undefined;
  return row
    ? { ...row, grantedScopes: row.grantedScopes.split(" ").filter(Boolean) }
    : null;
}

export function getGoogleRefreshToken(
  userId: number,
  encryptionKey: Buffer,
  connection: DatabaseConnection = getDatabase(),
): string {
  const row = connection.sqlite
    .prepare(
      `select encrypted_refresh_token as encryptedRefreshToken, status
       from google_connections where user_id = ?`,
    )
    .get(idSchema.parse(userId)) as
    { encryptedRefreshToken: string | null; status: string } | undefined;
  if (!row || row.status !== "connected" || !row.encryptedRefreshToken) {
    throw new Error("Google account is not connected.");
  }
  return decryptSecret(row.encryptedRefreshToken, encryptionKey);
}

export function storeGoogleConnection(
  userId: number,
  input: z.input<typeof connectionInputSchema>,
  encryptionKey: Buffer,
  connection: DatabaseConnection = getDatabase(),
): void {
  const ownerId = idSchema.parse(userId);
  const value = connectionInputSchema.parse(input);
  const existingOwner = connection.sqlite
    .prepare(
      "select user_id as userId from google_connections where google_subject = ?",
    )
    .get(value.googleSubject) as { userId: number } | undefined;
  if (existingOwner && existingOwner.userId !== ownerId) {
    throw new Error("This Google account is already connected.");
  }

  const now = Date.now();
  connection.sqlite.transaction(() => {
    connection.sqlite
      .prepare(
        `insert into google_connections
         (user_id, google_subject, account_email, encrypted_refresh_token,
          granted_scopes, status, connected_at, updated_at)
         values (?, ?, ?, ?, ?, 'connected', ?, ?)
         on conflict(user_id) do update set
           google_subject = excluded.google_subject,
           account_email = excluded.account_email,
           encrypted_refresh_token = excluded.encrypted_refresh_token,
           granted_scopes = excluded.granted_scopes,
           status = 'connected',
           connected_at = excluded.connected_at,
           updated_at = excluded.updated_at`,
      )
      .run(
        ownerId,
        value.googleSubject,
        value.accountEmail,
        encryptSecret(value.refreshToken, encryptionKey),
        [...new Set(value.grantedScopes)].sort().join(" "),
        now,
        now,
      );
    recordAuditEvent(
      {
        actorUserId: ownerId,
        action: "google.connection_create",
        targetType: "google_connection",
        targetId: String(ownerId),
        summary: "Google account connected",
      },
      connection,
    );
  })();
}

export function markGoogleConnectionRevoked(
  userId: number,
  connection: DatabaseConnection = getDatabase(),
): void {
  connection.sqlite
    .prepare(
      `update google_connections
       set encrypted_refresh_token = null, status = 'revoked', updated_at = ?
       where user_id = ?`,
    )
    .run(Date.now(), idSchema.parse(userId));
}

export function removeGoogleConnection(
  userId: number,
  connection: DatabaseConnection = getDatabase(),
): void {
  const ownerId = idSchema.parse(userId);
  connection.sqlite
    .prepare("delete from google_connections where user_id = ?")
    .run(ownerId);
  try {
    recordAuditEvent(
      {
        actorUserId: ownerId,
        action: "google.connection_remove",
        targetType: "google_connection",
        targetId: String(ownerId),
        summary: "Google account disconnected",
      },
      connection,
    );
  } catch {
    // Audit availability must never retain a credential the user disconnected.
  }
}

export function setGoogleDriveRootFolder(
  userId: number,
  folderId: string | null,
  connection: DatabaseConnection = getDatabase(),
): void {
  connection.sqlite
    .prepare(
      `update google_connections
       set drive_root_folder_id = ?, updated_at = ? where user_id = ?`,
    )
    .run(folderId, Date.now(), idSchema.parse(userId));
}
