import Database from "better-sqlite3";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

const configured = process.env.OPENSTUDYHUB_V2_DATABASE_PATH;
if (
  process.env.OPENSTUDYHUB_V2_ENABLED !== "1" ||
  !configured?.startsWith("/") ||
  resolve(configured) === resolve(process.env.DATABASE_PATH ?? "")
)
  throw new Error("Banco V2 separado não configurado.");
mkdirSync(dirname(configured), { recursive: true });
const db = new Database(configured);
try {
  db.pragma("foreign_keys=ON");
  db.pragma("busy_timeout=5000");
  db.pragma("journal_mode=WAL");
  db.exec(
    "CREATE TABLE IF NOT EXISTS v2_migration_log (version TEXT PRIMARY KEY, sha256 TEXT NOT NULL, applied_at INTEGER NOT NULL)",
  );
  const folder = resolve("v2-migrations");
  for (const name of readdirSync(folder)
    .filter((file) => /^\d{4}_[\w-]+\.sql$/.test(file))
    .sort()) {
    const sql = readFileSync(join(folder, name), "utf8");
    const sha = createHash("sha256").update(sql).digest("hex");
    const previous = db
      .prepare("SELECT sha256 FROM v2_migration_log WHERE version=?")
      .get(name);
    if (previous) {
      if (previous.sha256 !== sha)
        throw new Error(`Migration V2 modificada: ${name}`);
      continue;
    }
    db.transaction(() => {
      db.exec(sql);
      db.prepare(
        "INSERT INTO v2_migration_log(version,sha256,applied_at) VALUES(?,?,?)",
      ).run(name, sha, Date.now());
    })();
  }
  if (
    db.pragma("integrity_check", { simple: true }) !== "ok" ||
    db.pragma("foreign_key_check").length
  )
    throw new Error("Integridade V2 falhou.");
  console.log("Migrations V2 aplicadas.");
} finally {
  db.close();
}
