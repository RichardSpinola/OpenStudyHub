import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";

import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";

const configured =
  process.env.DATABASE_PATH?.trim() || "./data/openstudyhub.db";
const databasePath = resolve(process.cwd(), configured);
mkdirSync(dirname(databasePath), { recursive: true });

const sqlite = new Database(databasePath);
try {
  sqlite.pragma("foreign_keys = ON");
  const db = drizzle(sqlite);
  migrate(db, { migrationsFolder: resolve(process.cwd(), "drizzle") });
  console.log("OpenStudyHub migrations applied.");
} finally {
  sqlite.close();
}
