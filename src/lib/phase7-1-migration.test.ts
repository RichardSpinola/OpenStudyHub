import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { createDatabase, type DatabaseConnection } from "@/lib/db/client";
import { applyMigration, migrationFiles } from "@/lib/test-database";

describe("Phase 7.1 migration", () => {
  let connection: DatabaseConnection;

  beforeEach(() => {
    connection = createDatabase(":memory:");
    const migrationIndex = migrationFiles.indexOf(
      "0013_salty_christian_walker.sql",
    );
    for (const migration of migrationFiles.slice(0, migrationIndex)) {
      applyMigration(connection, migration);
    }
  });

  afterEach(() => connection.close());

  it("backfills legacy Drive credential owners without changing Hub owners", () => {
    const now = Date.now();
    const userId = Number(
      connection.sqlite
        .prepare(
          `insert into users
           (display_name, login, password_hash, role, active,
            password_changed_at, created_at, updated_at)
           values ('Owner', 'owner', 'hash', 'admin', 1, ?, ?, ?)`,
        )
        .run(now, now, now).lastInsertRowid,
    );
    const programId = Number(
      connection.sqlite
        .prepare("insert into programs (name) values ('Program')")
        .run().lastInsertRowid,
    );
    const subjectId = Number(
      connection.sqlite
        .prepare("insert into subjects (name) values ('Subject')")
        .run().lastInsertRowid,
    );
    const periodId = Number(
      connection.sqlite
        .prepare(
          "insert into academic_periods (label, starts_on, ends_on) values ('2030.1', '2030-01-01', '2030-06-30')",
        )
        .run().lastInsertRowid,
    );
    const offeringId = Number(
      connection.sqlite
        .prepare(
          "insert into subject_offerings (subject_id, program_id, academic_period_id) values (?, ?, ?)",
        )
        .run(subjectId, programId, periodId).lastInsertRowid,
    );
    connection.sqlite
      .prepare(
        `insert into offering_google_integrations
         (offering_id, drive_folder_id, drive_folder_name, updated_by_user_id)
         values (?, 'folder', 'Subject', ?)`,
      )
      .run(offeringId, userId);
    const templateId = Number(
      connection.sqlite
        .prepare(
          `insert into document_templates
           (owner_user_id, name, source_file_id, naming_pattern)
           values (?, 'Template', '1234567890source', '{{subject.name}}')`,
        )
        .run(userId).lastInsertRowid,
    );
    connection.sqlite
      .prepare(
        `insert into generated_documents
         (owner_user_id, template_id, offering_id, drive_file_id,
          web_view_link, name)
         values (?, ?, ?, 'generated', 'https://docs.google.com/document/d/generated/edit', 'Generated')`,
      )
      .run(userId, templateId, offeringId);

    applyMigration(connection, "0013_salty_christian_walker.sql");

    expect(
      connection.sqlite
        .prepare(
          "select storage_user_id as storageUserId from document_templates where id = ?",
        )
        .get(templateId),
    ).toEqual({ storageUserId: userId });
    expect(
      connection.sqlite
        .prepare(
          "select storage_user_id as storageUserId, owner_user_id as ownerUserId from generated_documents",
        )
        .get(),
    ).toEqual({ storageUserId: userId, ownerUserId: userId });
    expect(
      connection.sqlite
        .prepare(
          "select drive_storage_user_id as storageUserId from offering_google_integrations where offering_id = ?",
        )
        .get(offeringId),
    ).toEqual({ storageUserId: userId });
  });
});
