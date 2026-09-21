import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { createDatabase, type DatabaseConnection } from "@/lib/db/client";
import { applyMigration, migrationFiles } from "@/lib/test-database";

describe("Phase 7 migration", () => {
  let connection: DatabaseConnection;
  beforeEach(() => {
    connection = createDatabase(":memory:");
  });
  afterEach(() => connection.close());

  it("preserves existing users and only onboards newly created accounts", () => {
    const phase7Index = migrationFiles.indexOf("0012_lean_rictor.sql");
    for (const migration of migrationFiles.slice(0, phase7Index)) {
      applyMigration(connection, migration);
    }
    const now = Date.now();
    const existingId = Number(
      connection.sqlite
        .prepare(
          `insert into users
           (display_name, login, password_hash, role, active,
            password_changed_at, created_at, updated_at)
           values ('Existing', 'existing', 'hash', 'member', 1, ?, ?, ?)`,
        )
        .run(now, now, now).lastInsertRowid,
    );
    applyMigration(connection, "0012_lean_rictor.sql");
    const newId = Number(
      connection.sqlite
        .prepare(
          `insert into users
           (display_name, login, password_hash, role, active,
            password_changed_at, created_at, updated_at)
           values ('New', 'new', 'hash', 'member', 1, ?, ?, ?)`,
        )
        .run(now, now, now).lastInsertRowid,
    );
    expect(
      connection.sqlite
        .prepare("select onboarding_version as version from users where id = ?")
        .get(existingId),
    ).toEqual({ version: 1 });
    expect(
      connection.sqlite
        .prepare("select onboarding_version as version from users where id = ?")
        .get(newId),
    ).toEqual({ version: 0 });
    expect(
      connection.sqlite
        .prepare(
          "select count(*) as count from sqlite_master where type = 'table' and name in ('study_groups', 'chat_rooms', 'notifications')",
        )
        .get(),
    ).toEqual({ count: 3 });
  });
});
