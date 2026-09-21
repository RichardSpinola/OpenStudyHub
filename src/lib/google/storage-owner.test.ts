import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { DatabaseConnection } from "@/lib/db/client";
import { createMigratedTestDatabase } from "@/lib/test-database";

import {
  getConfiguredDriveStorageOwnerId,
  listDriveStorageOwnerCandidates,
  resolveDriveStorageUser,
  setDriveStorageOwner,
} from "./storage-owner";

function createUser(
  connection: DatabaseConnection,
  login: string,
  role: "admin" | "member",
  active = true,
) {
  const now = Date.now();
  return Number(
    connection.sqlite
      .prepare(
        `insert into users
         (display_name, login, password_hash, role, active,
          password_changed_at, created_at, updated_at)
         values (?, ?, 'hash', ?, ?, ?, ?, ?)`,
      )
      .run(login, login, role, Number(active), now, now, now).lastInsertRowid,
  );
}

function connectGoogle(connection: DatabaseConnection, userId: number) {
  connection.sqlite
    .prepare(
      `insert into google_connections
       (user_id, google_subject, account_email, encrypted_refresh_token,
        granted_scopes, status)
       values (?, ?, ?, 'encrypted', 'drive.file', 'connected')`,
    )
    .run(userId, `google-${userId}`, `${userId}@example.test`);
}

describe("central Drive storage owner", () => {
  let connection: DatabaseConnection;

  beforeEach(() => {
    connection = createMigratedTestDatabase();
  });

  afterEach(() => connection.close());

  it("aceita somente usuário ativo conectado e somente por ADMIN", () => {
    const adminId = createUser(connection, "admin", "admin");
    const memberId = createUser(connection, "member", "member");
    const disconnectedId = createUser(connection, "offline", "member");
    connectGoogle(connection, memberId);

    expect(() => setDriveStorageOwner(memberId, memberId, connection)).toThrow(
      "Admin access required.",
    );
    expect(() =>
      setDriveStorageOwner(adminId, disconnectedId, connection),
    ).toThrow("active connected user");

    setDriveStorageOwner(adminId, memberId, connection);
    expect(getConfiguredDriveStorageOwnerId(connection)).toBe(memberId);
    expect(listDriveStorageOwnerCandidates(connection)).toEqual([
      {
        userId: memberId,
        displayName: "member",
        accountEmail: `${memberId}@example.test`,
      },
    ]);
  });

  it("preserva dono persistido e não faz fallback silencioso", () => {
    const adminId = createUser(connection, "admin-2", "admin");
    const ownerId = createUser(connection, "owner", "member");
    const legacyId = createUser(connection, "legacy", "member");
    connectGoogle(connection, ownerId);
    setDriveStorageOwner(adminId, ownerId, connection);

    expect(resolveDriveStorageUser(legacyId, null, { connection })).toBe(
      ownerId,
    );
    expect(resolveDriveStorageUser(legacyId, legacyId, { connection })).toBe(
      legacyId,
    );
    expect(
      resolveDriveStorageUser(legacyId, null, {
        connection,
        useConfiguredForNew: false,
      }),
    ).toBe(legacyId);

    connection.sqlite
      .prepare(
        "update google_connections set status = 'revoked', encrypted_refresh_token = null where user_id = ?",
      )
      .run(ownerId);
    expect(resolveDriveStorageUser(legacyId, null, { connection })).toBe(
      ownerId,
    );
    expect(listDriveStorageOwnerCandidates(connection)).toEqual([]);
  });
});
