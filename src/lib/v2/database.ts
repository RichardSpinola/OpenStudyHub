import Database from "better-sqlite3";
import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";

export type V2Database = Database.Database;
export const V2_MIGRATIONS = resolve(process.cwd(), "v2-migrations");

export function openV2Database(path: string): V2Database {
  const db = new Database(path);
  db.pragma("foreign_keys = ON");
  db.pragma("busy_timeout = 5000");
  if (path !== ":memory:") db.pragma("journal_mode = WAL");
  return db;
}

export function migrateV2(db: V2Database, folder = V2_MIGRATIONS): void {
  db.exec(`CREATE TABLE IF NOT EXISTS v2_migration_log (
    version TEXT PRIMARY KEY, sha256 TEXT NOT NULL, applied_at INTEGER NOT NULL
  )`);
  for (const name of readdirSync(folder)
    .filter((x) => /^\d{4}_[\w-]+\.sql$/.test(x))
    .sort()) {
    const sql = readFileSync(join(folder, name), "utf8");
    const sha256 = createHash("sha256").update(sql).digest("hex");
    const found = db
      .prepare("SELECT sha256 FROM v2_migration_log WHERE version=?")
      .get(name) as { sha256: string } | undefined;
    if (found) {
      if (found.sha256 !== sha256)
        throw new Error(`V2 migration changed: ${name}`);
      continue;
    }
    db.transaction(() => {
      db.exec(sql);
      db.prepare(
        "INSERT INTO v2_migration_log(version,sha256,applied_at) VALUES(?,?,?)",
      ).run(name, sha256, Date.now());
    })();
  }
}
