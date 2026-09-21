import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname, isAbsolute, resolve } from "node:path";

import { getServerEnvironment } from "@/lib/env";

import * as schema from "./schema";

export type DatabaseConnection = ReturnType<typeof createDatabase>;

function resolveDatabasePath(databasePath: string): string {
  if (databasePath === ":memory:" || isAbsolute(databasePath)) {
    return databasePath;
  }

  return resolve(/* turbopackIgnore: true */ process.cwd(), databasePath);
}

export function createDatabase(databasePath: string) {
  const resolvedPath = resolveDatabasePath(databasePath);

  if (resolvedPath !== ":memory:") {
    mkdirSync(dirname(resolvedPath), { recursive: true });
  }

  const sqlite = new Database(resolvedPath);
  sqlite.pragma("foreign_keys = ON");

  if (resolvedPath !== ":memory:") {
    sqlite.pragma("journal_mode = WAL");
  }

  return {
    db: drizzle(sqlite, { schema }),
    sqlite,
    close: () => sqlite.close(),
  };
}

const globalDatabase = globalThis as typeof globalThis & {
  openStudyHubDatabase?: DatabaseConnection;
};

export function getDatabase(): DatabaseConnection {
  globalDatabase.openStudyHubDatabase ??= createDatabase(
    getServerEnvironment().DATABASE_PATH,
  );

  return globalDatabase.openStudyHubDatabase;
}

export function checkDatabaseConnection(
  connection: DatabaseConnection = getDatabase(),
): boolean {
  const result = connection.sqlite.prepare("select 1 as operational").get() as
    { operational: number } | undefined;

  return result?.operational === 1;
}
