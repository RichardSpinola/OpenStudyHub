import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { applyMigration } from "@/lib/test-database";

import { createDatabase, type DatabaseConnection } from "./client";

describe("migrations acadêmicas", () => {
  let connection: DatabaseConnection;

  beforeEach(() => {
    connection = createDatabase(":memory:");
  });

  afterEach(() => connection.close());

  it("aplica a sequência completa em banco limpo", () => {
    applyMigration(connection, "0000_kind_cobalt_man.sql");
    applyMigration(connection, "0001_academic_core.sql");
    applyMigration(connection, "0002_access_admin_foundation.sql");
    applyMigration(connection, "0003_omniscient_colleen_wing.sql");
    applyMigration(connection, "0004_busy_blackheart.sql");
    applyMigration(connection, "0005_elite_darkstar.sql");
    applyMigration(connection, "0006_lush_union_jack.sql");
    applyMigration(connection, "0007_flat_abomination.sql");

    const tables = connection.sqlite
      .prepare(
        `select name from sqlite_master
         where type = 'table' and name not like 'sqlite_%'
         order by name`,
      )
      .all() as Array<{ name: string }>;

    expect(tables.map(({ name }) => name)).toEqual([
      "academic_periods",
      "activities",
      "app_settings",
      "audit_events",
      "cohorts",
      "curator_cohort_scopes",
      "enrollments",
      "google_connections",
      "google_oauth_states",
      "instructors",
      "locations",
      "login_rate_limits",
      "moderator_program_scopes",
      "offering_google_integrations",
      "programs",
      "schedule_slots",
      "sessions",
      "shortcuts",
      "subject_offerings",
      "subjects",
      "timeline_events",
      "user_academic_memberships",
      "user_shortcuts",
      "users",
    ]);
  });

  it("atualiza uma base da Fase 1 sem perder settings, atalhos ou subjects", () => {
    applyMigration(connection, "0000_kind_cobalt_man.sql");
    connection.sqlite
      .prepare("insert into app_settings (key, value) values (?, ?)")
      .run("ui.language", "en");
    connection.sqlite
      .prepare(
        "insert into shortcuts (name, url, icon, sort_order) values (?, ?, ?, ?)",
      )
      .run("Example", "https://example.com", "EX", 0);
    connection.sqlite
      .prepare(
        `insert into subjects (code, name, short_name, program, semester)
         values (?, ?, ?, ?, ?)`,
      )
      .run(
        "LEG-1",
        "Legacy Subject",
        "Legacy",
        "Legacy Program",
        "Legacy Term",
      );

    applyMigration(connection, "0001_academic_core.sql");
    applyMigration(connection, "0002_access_admin_foundation.sql");
    applyMigration(connection, "0003_omniscient_colleen_wing.sql");
    applyMigration(connection, "0004_busy_blackheart.sql");
    applyMigration(connection, "0005_elite_darkstar.sql");
    applyMigration(connection, "0006_lush_union_jack.sql");
    applyMigration(connection, "0007_flat_abomination.sql");

    expect(
      connection.sqlite.prepare("select key, value from app_settings").get(),
    ).toEqual({ key: "ui.language", value: "en" });
    expect(
      connection.sqlite.prepare("select name, url from shortcuts").get(),
    ).toEqual({ name: "Example", url: "https://example.com" });
    expect(
      connection.sqlite
        .prepare("select name, program, semester from subjects")
        .get(),
    ).toEqual({
      name: "Legacy Subject",
      program: "Legacy Program",
      semester: "Legacy Term",
    });
    expect(
      connection.sqlite
        .prepare(
          "select count(*) as count from sqlite_master where type = 'table' and name = 'subject_offerings'",
        )
        .get(),
    ).toEqual({ count: 1 });
    expect(connection.sqlite.pragma("foreign_keys", { simple: true })).toBe(1);
  });

  it("atualiza uma base da Fase 2 sem perder dados acadêmicos", () => {
    applyMigration(connection, "0000_kind_cobalt_man.sql");
    applyMigration(connection, "0001_academic_core.sql");
    connection.sqlite
      .prepare("insert into programs (code, name) values (?, ?)")
      .run("DEMO", "Programa Demonstrativo");
    connection.sqlite
      .prepare(
        "insert into academic_periods (label, starts_on, ends_on) values (?, ?, ?)",
      )
      .run("2030.1", "2030-01-01", "2030-06-30");

    applyMigration(connection, "0002_access_admin_foundation.sql");
    applyMigration(connection, "0003_omniscient_colleen_wing.sql");
    applyMigration(connection, "0004_busy_blackheart.sql");
    applyMigration(connection, "0005_elite_darkstar.sql");
    applyMigration(connection, "0006_lush_union_jack.sql");
    applyMigration(connection, "0007_flat_abomination.sql");

    expect(
      connection.sqlite.prepare("select code, name from programs").get(),
    ).toEqual({ code: "DEMO", name: "Programa Demonstrativo" });
    expect(
      connection.sqlite.prepare("select label from academic_periods").get(),
    ).toEqual({ label: "2030.1" });
  });

  it("atualiza uma base da Fase 3A sem conceder matrículas implícitas", () => {
    applyMigration(connection, "0000_kind_cobalt_man.sql");
    applyMigration(connection, "0001_academic_core.sql");
    applyMigration(connection, "0002_access_admin_foundation.sql");
    applyMigration(connection, "0003_omniscient_colleen_wing.sql");
    const now = Date.now();
    connection.sqlite
      .prepare(
        `insert into users
         (display_name, login, password_hash, role, active,
          password_changed_at, created_at, updated_at)
         values ('Pessoa Existente', 'existente', 'hash', 'member', 1, ?, ?, ?)`,
      )
      .run(now, now, now);

    applyMigration(connection, "0004_busy_blackheart.sql");
    applyMigration(connection, "0005_elite_darkstar.sql");
    applyMigration(connection, "0006_lush_union_jack.sql");
    applyMigration(connection, "0007_flat_abomination.sql");

    expect(
      connection.sqlite
        .prepare(
          "select today_widget_enabled as enabled from users where login = 'existente'",
        )
        .get(),
    ).toEqual({ enabled: 1 });
    expect(
      connection.sqlite
        .prepare("select count(*) as count from enrollments")
        .get(),
    ).toEqual({ count: 0 });
  });

  it("atualiza uma base da fundação de acesso sem perder usuários ou sessões", () => {
    applyMigration(connection, "0000_kind_cobalt_man.sql");
    applyMigration(connection, "0001_academic_core.sql");
    applyMigration(connection, "0002_access_admin_foundation.sql");
    connection.sqlite
      .prepare("insert into app_settings (key, value) values (?, ?)")
      .run("ui.language", "en");
    const now = Date.now();
    connection.sqlite
      .prepare(
        `insert into users
         (display_name, login, password_hash, role, active,
          password_changed_at, created_at, updated_at)
         values (?, ?, ?, 'member', 1, ?, ?, ?)`,
      )
      .run("Pessoa Existente", "pessoa.existente", "hash-teste", now, now, now);
    const userId = Number(
      (
        connection.sqlite
          .prepare("select id from users where login = ?")
          .get("pessoa.existente") as { id: number }
      ).id,
    );
    connection.sqlite
      .prepare(
        `insert into sessions
         (user_id, token_hash, created_at, expires_at)
         values (?, ?, ?, ?)`,
      )
      .run(userId, "hash-sessao-teste", now, now + 60_000);
    connection.sqlite
      .prepare(
        `insert into shortcuts (name, url, icon, sort_order)
         values (?, ?, ?, ?)`,
      )
      .run("Default existente", "https://example.test", "EX", 0);

    applyMigration(connection, "0003_omniscient_colleen_wing.sql");
    applyMigration(connection, "0004_busy_blackheart.sql");
    applyMigration(connection, "0005_elite_darkstar.sql");
    applyMigration(connection, "0006_lush_union_jack.sql");
    applyMigration(connection, "0007_flat_abomination.sql");

    expect(
      connection.sqlite
        .prepare(
          `select display_name as displayName, locale,
                  shortcuts_initialized as shortcutsInitialized
           from users where id = ?`,
        )
        .get(userId),
    ).toEqual({
      displayName: "Pessoa Existente",
      locale: "en",
      shortcutsInitialized: 0,
    });
    expect(
      connection.sqlite
        .prepare("select user_id as userId from sessions where token_hash = ?")
        .get("hash-sessao-teste"),
    ).toEqual({ userId });
    expect(connection.sqlite.pragma("foreign_key_check")).toEqual([]);
  });

  it("atualiza a Phase 3D sem alterar usuários, memberships ou matrículas", () => {
    applyMigration(connection, "0000_kind_cobalt_man.sql");
    applyMigration(connection, "0001_academic_core.sql");
    applyMigration(connection, "0002_access_admin_foundation.sql");
    applyMigration(connection, "0003_omniscient_colleen_wing.sql");
    applyMigration(connection, "0004_busy_blackheart.sql");
    applyMigration(connection, "0005_elite_darkstar.sql");
    const now = Date.now();
    connection.sqlite
      .prepare(
        `insert into users
         (display_name, login, password_hash, role, active,
          password_changed_at, created_at, updated_at)
         values ('Existente', 'existente.3d', 'hash', 'member', 1, ?, ?, ?)`,
      )
      .run(now, now, now);

    applyMigration(connection, "0006_lush_union_jack.sql");
    applyMigration(connection, "0007_flat_abomination.sql");

    expect(
      connection.sqlite
        .prepare("select role from users where login = 'existente.3d'")
        .get(),
    ).toEqual({ role: "member" });
    expect(
      connection.sqlite
        .prepare("select count(*) as count from moderator_program_scopes")
        .get(),
    ).toEqual({ count: 0 });
    expect(
      connection.sqlite
        .prepare("select count(*) as count from curator_cohort_scopes")
        .get(),
    ).toEqual({ count: 0 });
  });

  it("adiciona a Phase 6 sem perder usuários, notas ou documentos", () => {
    applyMigration(connection, "0000_kind_cobalt_man.sql");
    applyMigration(connection, "0001_academic_core.sql");
    applyMigration(connection, "0002_access_admin_foundation.sql");
    applyMigration(connection, "0003_omniscient_colleen_wing.sql");
    applyMigration(connection, "0004_busy_blackheart.sql");
    applyMigration(connection, "0005_elite_darkstar.sql");
    applyMigration(connection, "0006_lush_union_jack.sql");
    applyMigration(connection, "0007_flat_abomination.sql");
    applyMigration(connection, "0008_medical_emma_frost.sql");
    const now = Date.now();
    const userId = Number(
      connection.sqlite
        .prepare(
          `insert into users
           (display_name, login, password_hash, role, active,
            password_changed_at, created_at, updated_at)
           values ('Pessoa', 'phase6.user', 'hash', 'member', 1, ?, ?, ?)`,
        )
        .run(now, now, now).lastInsertRowid,
    );
    connection.sqlite
      .prepare(
        "insert into notes (owner_user_id, title, content) values (?, 'Nota preservada', 'Conteúdo')",
      )
      .run(userId);
    const programId = Number(
      connection.sqlite
        .prepare("insert into programs (name) values ('Programa')")
        .run().lastInsertRowid,
    );
    const subjectId = Number(
      connection.sqlite
        .prepare("insert into subjects (name) values ('Disciplina')")
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
        `insert into generated_documents
         (owner_user_id, offering_id, drive_file_id, web_view_link, name)
         values (?, ?, 'drive-test', 'https://example.test/document', 'Documento preservado')`,
      )
      .run(userId, offeringId);

    applyMigration(connection, "0009_overrated_nekra.sql");
    applyMigration(connection, "0010_polite_spyke.sql");
    const projectId = Number(
      connection.sqlite
        .prepare(
          `insert into projects
           (owner_user_id, offering_id, name, language, ignore_preset,
            current_version_number)
           values (?, ?, 'Projeto preservado', 'javascript-typescript',
                   'javascript-typescript', 1)`,
        )
        .run(userId, offeringId).lastInsertRowid,
    );
    connection.sqlite
      .prepare(
        `insert into project_versions
         (project_id, version_number, archive_drive_file_id, manifest_json,
          created_by_user_id)
         values (?, 1, 'archive-preserved', '{"schemaVersion":1,"files":[]}', ?)`,
      )
      .run(projectId, userId);
    applyMigration(connection, "0011_round_carnage.sql");

    expect(
      connection.sqlite.prepare("select title, content from notes").get(),
    ).toEqual({ title: "Nota preservada", content: "Conteúdo" });
    expect(
      connection.sqlite.prepare("select name from generated_documents").get(),
    ).toEqual({ name: "Documento preservado" });
    const newTables = [
      "classroom_feed_items",
      "classroom_sync_states",
      "projects",
      "project_directories",
      "project_files",
      "project_versions",
      "project_upload_previews",
      "storage_settings",
      "user_home_assets",
    ];
    for (const name of newTables) {
      expect(
        connection.sqlite
          .prepare(
            "select count(*) as count from sqlite_master where type = 'table' and name = ?",
          )
          .get(name),
      ).toEqual({ count: 1 });
    }
    expect(connection.sqlite.pragma("foreign_key_check")).toEqual([]);
    expect(
      connection.sqlite
        .prepare(
          `select technologies_json as technologiesJson,
                  current_version_number as currentVersionNumber
           from projects where id = ?`,
        )
        .get(projectId),
    ).toEqual({ technologiesJson: "[]", currentVersionNumber: 1 });
    expect(
      connection.sqlite
        .prepare(
          "select archive_drive_file_id as archiveDriveFileId from project_versions where project_id = ?",
        )
        .get(projectId),
    ).toEqual({ archiveDriveFileId: "archive-preserved" });
    expect(
      connection.sqlite
        .prepare(
          `select theme, home_clock_enabled as homeClockEnabled,
                  home_clock_position as homeClockPosition
           from users where id = ?`,
        )
        .get(userId),
    ).toEqual({
      theme: "dark",
      homeClockEnabled: 1,
      homeClockPosition: "top-right",
    });
  });
});
