import { expect, it } from "vitest";
import {
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { createDatabase } from "../db/client";
import { migrateV2, openV2Database, V2_MIGRATIONS } from "./database";
import { seedV2Fake } from "./fixtures";

it("upgrades synthetic populated databases from the server's 0015/0021 versions twice without losing private content or widening permissions", () => {
  const root = mkdtempSync(join(tmpdir(), "osh-stage8-upgrade-"));
  const oldApp = join(root, "old-app"),
    oldCanonical = join(root, "old-canonical");
  mkdirSync(join(oldApp, "meta"), { recursive: true });
  mkdirSync(oldCanonical);
  const journal = JSON.parse(
    readFileSync(resolve("drizzle/meta/_journal.json"), "utf8"),
  );
  journal.entries = journal.entries.filter((e: { idx: number }) => e.idx <= 15);
  writeFileSync(join(oldApp, "meta/_journal.json"), JSON.stringify(journal));
  for (const e of journal.entries)
    copyFileSync(
      resolve("drizzle", e.tag + ".sql"),
      join(oldApp, e.tag + ".sql"),
    );
  for (const name of readdirSync(V2_MIGRATIONS).filter(
    (n) => n.endsWith(".sql") && Number(n.slice(0, 4)) <= 21,
  ))
    copyFileSync(join(V2_MIGRATIONS, name), join(oldCanonical, name));
  const app = createDatabase(join(root, "app.db")),
    canonical = openV2Database(join(root, "v2.db"));
  try {
    migrate(app.db, { migrationsFolder: oldApp });
    migrateV2(canonical, oldCanonical);
    seedV2Fake(canonical);
    app.sqlite.exec(
      "INSERT INTO users(id,display_name,login,password_hash,role) VALUES(10,'Privado','private.fake','fake','member'); INSERT INTO programs(id,name) VALUES(1,'Curso'); INSERT INTO subjects(id,name) VALUES(1,'Disciplina'); INSERT INTO academic_periods(id,label,starts_on,ends_on) VALUES(1,'2026.2','2026-08-01','2026-12-31'); INSERT INTO subject_offerings(id,subject_id,program_id,academic_period_id) VALUES(1,1,1,1); INSERT INTO notes(id,owner_user_id,offering_id,title,content) VALUES(1,10,1,'Nota privada','Preservar conteúdo'); INSERT INTO projects(id,owner_user_id,offering_id,name,language,ignore_preset) VALUES(1,10,1,'Projeto antigo','other','other'); INSERT INTO project_versions(project_id,version_number,archive_drive_file_id,manifest_json,created_by_user_id) VALUES(1,1,'remote-existing','[]',10);",
    );
    const oldNotes = app.sqlite.prepare("SELECT * FROM notes").all(),
      oldVersions = app.sqlite.prepare("SELECT * FROM project_versions").all(),
      grants = canonical.prepare("SELECT * FROM permission_grants").all();
    canonical
      .prepare(
        "INSERT INTO local_documents(user_id,name,mime_type,content,size_bytes,created_at,updated_at) VALUES(3,'Privado.txt','text/plain',?,7,1,1)",
      )
      .run(Buffer.from("privado"));
    for (let repeat = 0; repeat < 2; repeat++) {
      migrate(app.db, { migrationsFolder: resolve("drizzle") });
      migrateV2(canonical);
    }
    expect(app.sqlite.prepare("SELECT * FROM notes").all()).toMatchObject(
      oldNotes,
    );
    expect(app.sqlite.prepare("SELECT * FROM project_versions").all()).toEqual(
      oldVersions,
    );
    expect(canonical.prepare("SELECT * FROM permission_grants").all()).toEqual(
      grants,
    );
    expect(
      (
        canonical.prepare("SELECT content FROM local_documents").get() as {
          content: Buffer;
        }
      ).content.toString(),
    ).toBe("privado");
    expect(
      app.sqlite.prepare("SELECT count(*) n FROM __drizzle_migrations").get(),
    ).toEqual({ n: 24 });
    expect(
      canonical.prepare("SELECT count(*) n FROM v2_migration_log").get(),
    ).toEqual({ n: 33 });
    for (const db of [app.sqlite, canonical]) {
      expect(db.pragma("foreign_key_check")).toEqual([]);
      expect(db.pragma("integrity_check", { simple: true })).toBe("ok");
    }
  } finally {
    app.close();
    canonical.close();
    rmSync(root, { recursive: true, force: true });
  }
});
