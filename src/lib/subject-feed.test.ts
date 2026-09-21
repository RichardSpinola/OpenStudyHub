import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { DatabaseConnection } from "@/lib/db/client";
import { createMigratedTestDatabase } from "@/lib/test-database";

import { findNextSubjectFeedItem, listUserSubjectFeed } from "./subject-feed";

function seed(connection: DatabaseConnection) {
  const now = Date.now();
  const users = connection.sqlite.prepare(
    `insert into users
     (display_name, login, password_hash, role, active,
      password_changed_at, created_at, updated_at)
     values (?, ?, 'hash', 'member', 1, ?, ?, ?)`,
  );
  const ownerId = Number(
    users.run("Owner", "owner-feed", now, now, now).lastInsertRowid,
  );
  const otherId = Number(
    users.run("Other", "other-feed", now, now, now).lastInsertRowid,
  );
  const programId = Number(
    connection.sqlite
      .prepare("insert into programs (name) values ('Programa')")
      .run().lastInsertRowid,
  );
  const subjectId = Number(
    connection.sqlite
      .prepare("insert into subjects (name) values ('POO')")
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
  const enroll = connection.sqlite.prepare(
    "insert into enrollments (user_id, offering_id) values (?, ?)",
  );
  enroll.run(ownerId, offeringId);
  enroll.run(otherId, offeringId);
  connection.sqlite
    .prepare(
      `insert into activities
       (user_id, offering_id, title, due_at, created_at, updated_at)
       values (?, ?, ?, ?, ?, ?)`,
    )
    .run(ownerId, offeringId, "Activity própria", now + 5_000, now - 50, now);
  connection.sqlite
    .prepare(
      `insert into notes
       (owner_user_id, offering_id, title, content, created_at, updated_at)
       values (?, ?, ?, '', ?, ?)`,
    )
    .run(ownerId, offeringId, "Note própria", now - 40, now);
  connection.sqlite
    .prepare(
      `insert into notes
       (owner_user_id, offering_id, title, content, created_at, updated_at)
       values (?, ?, ?, '', ?, ?)`,
    )
    .run(otherId, offeringId, "Note alheia", now - 30, now);
  const templateId = Number(
    connection.sqlite
      .prepare(
        `insert into document_templates
         (owner_user_id, name, source_file_id, naming_pattern)
         values (?, 'Template', 'template-file-id', '{{document.title}}')`,
      )
      .run(ownerId).lastInsertRowid,
  );
  connection.sqlite
    .prepare(
      `insert into generated_documents
       (owner_user_id, template_id, offering_id, drive_file_id,
        web_view_link, name, created_at, updated_at)
       values (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      ownerId,
      templateId,
      offeringId,
      "owner-document",
      "https://docs.google.com/document/d/owner-document/edit",
      "Documento próprio",
      now - 20,
      now,
    );
  const otherTemplateId = Number(
    connection.sqlite
      .prepare(
        `insert into document_templates
         (owner_user_id, name, source_file_id, naming_pattern)
         values (?, 'Template', 'other-template-id', '{{document.title}}')`,
      )
      .run(otherId).lastInsertRowid,
  );
  connection.sqlite
    .prepare(
      `insert into generated_documents
       (owner_user_id, template_id, offering_id, drive_file_id,
        web_view_link, name, created_at, updated_at)
       values (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      otherId,
      otherTemplateId,
      offeringId,
      "other-document",
      "https://docs.google.com/document/d/other-document/edit",
      "Documento alheio",
      now - 10,
      now,
    );
  connection.sqlite
    .prepare(
      `insert into timeline_events
       (offering_id, type, title, starts_at, created_at, updated_at)
       values (?, 'academic_event', 'Prova', ?, ?, ?)`,
    )
    .run(offeringId, now + 10_000, now, now);
  const ownerProjectId = Number(
    connection.sqlite
      .prepare(
        `insert into projects
         (owner_user_id, offering_id, name, language, ignore_preset,
          current_version_number, sync_status, created_at, updated_at)
         values (?, ?, 'Projeto próprio', 'other', 'other', 1, 'complete', ?, ?)`,
      )
      .run(ownerId, offeringId, now - 15, now).lastInsertRowid,
  );
  connection.sqlite
    .prepare(
      `insert into project_versions
       (project_id, version_number, archive_drive_file_id, manifest_json,
        created_by_user_id, created_at)
       values (?, 1, 'owner-archive', '{"schemaVersion":1,"files":[]}', ?, ?)`,
    )
    .run(ownerProjectId, ownerId, now - 15);
  const otherProjectId = Number(
    connection.sqlite
      .prepare(
        `insert into projects
         (owner_user_id, offering_id, name, language, ignore_preset,
          current_version_number, sync_status, created_at, updated_at)
         values (?, ?, 'Projeto alheio', 'other', 'other', 1, 'complete', ?, ?)`,
      )
      .run(otherId, offeringId, now - 5, now).lastInsertRowid,
  );
  connection.sqlite
    .prepare(
      `insert into project_versions
       (project_id, version_number, archive_drive_file_id, manifest_json,
        created_by_user_id, created_at)
       values (?, 1, 'other-archive', '{"schemaVersion":1,"files":[]}', ?, ?)`,
    )
    .run(otherProjectId, otherId, now - 5);
  return { ownerId, subjectId, now };
}

describe("subject feed", () => {
  let connection: DatabaseConnection;

  beforeEach(() => {
    connection = createMigratedTestDatabase();
  });
  afterEach(() => connection.close());

  it("combina dados úteis, ordena e preserva ownership privado", () => {
    const { ownerId, subjectId } = seed(connection);
    const items = listUserSubjectFeed(ownerId, subjectId, connection);
    expect(items.map(({ title }) => title)).toEqual(
      expect.arrayContaining([
        "Activity própria",
        "Note própria",
        "Documento próprio",
        "Projeto próprio · v0001",
        "Prova",
      ]),
    );
    expect(items.map(({ title }) => title)).not.toContain("Note alheia");
    expect(items.map(({ title }) => title)).not.toContain("Documento alheio");
    expect(items.map(({ title }) => title)).not.toContain(
      "Projeto alheio · v0001",
    );
    expect(items.map(({ occurredAt }) => occurredAt)).toEqual(
      [...items.map(({ occurredAt }) => occurredAt)].sort((a, b) => b - a),
    );
  });

  it("encontra o próximo item acionável e lida com vazio", () => {
    const { ownerId, subjectId, now } = seed(connection);
    const items = listUserSubjectFeed(ownerId, subjectId, connection);
    expect(findNextSubjectFeedItem(items, now)?.title).toBe("Activity própria");
    expect(findNextSubjectFeedItem([], now)).toBeNull();
  });
});
