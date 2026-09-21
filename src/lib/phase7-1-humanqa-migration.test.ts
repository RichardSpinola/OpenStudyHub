import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { createDatabase, type DatabaseConnection } from "@/lib/db/client";
import { applyMigration, migrationFiles } from "@/lib/test-database";

describe("Phase 7.1 Human QA migration", () => {
  let connection: DatabaseConnection;

  beforeEach(() => {
    connection = createDatabase(":memory:");
    const migrationIndex = migrationFiles.indexOf("0014_left_butterfly.sql");
    for (const migration of migrationFiles.slice(0, migrationIndex)) {
      applyMigration(connection, migration);
    }
  });

  afterEach(() => connection.close());

  it("preserva templates existentes com a categoria documents", () => {
    const now = Date.now();
    const userId = Number(
      connection.sqlite
        .prepare(
          `insert into users
           (display_name, login, password_hash, role, active,
            password_changed_at, created_at, updated_at)
           values ('Owner', 'owner', 'hash', 'member', 1, ?, ?, ?)`,
        )
        .run(now, now, now).lastInsertRowid,
    );
    const templateId = Number(
      connection.sqlite
        .prepare(
          `insert into document_templates
           (owner_user_id, storage_user_id, name, description, source_file_id,
            naming_pattern, required_placeholders, active, created_at, updated_at)
           values (?, ?, 'Template antigo', 'Preservar', '1234567890source',
                   '{{subject.name}}', '["subject.name"]', 0, ?, ?)`,
        )
        .run(userId, userId, now, now).lastInsertRowid,
    );

    applyMigration(connection, "0014_left_butterfly.sql");

    expect(
      connection.sqlite
        .prepare(
          `select id, owner_user_id as ownerUserId,
                  storage_user_id as storageUserId, name, description,
                  category_kind as categoryKind, source_file_id as sourceFileId,
                  naming_pattern as namingPattern,
                  required_placeholders as requiredPlaceholders, active
           from document_templates where id = ?`,
        )
        .get(templateId),
    ).toEqual({
      id: templateId,
      ownerUserId: userId,
      storageUserId: userId,
      name: "Template antigo",
      description: "Preservar",
      categoryKind: "documents",
      sourceFileId: "1234567890source",
      namingPattern: "{{subject.name}}",
      requiredPlaceholders: '["subject.name"]',
      active: 0,
    });
    expect(connection.sqlite.pragma("foreign_key_check")).toEqual([]);
  });
});
