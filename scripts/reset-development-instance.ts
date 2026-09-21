import { existsSync, mkdirSync, unlinkSync } from "node:fs";
import { basename, resolve } from "node:path";

import { migrate } from "drizzle-orm/better-sqlite3/migrator";

import { createDatabase } from "../src/lib/db/client";
import {
  DEVELOPMENT_RESET_ENV_VALUE,
  validateDevelopmentReset,
} from "../src/lib/development-reset";
import { getServerEnvironment } from "../src/lib/env";
import { loadProjectEnvironment } from "../src/lib/load-project-environment";

loadProjectEnvironment();

const projectDirectory = process.cwd();
const environment = getServerEnvironment();
const databasePath = validateDevelopmentReset({
  nodeEnvironment: environment.NODE_ENV,
  confirmationValue: process.env.OPENSTUDYHUB_ALLOW_DEVELOPMENT_RESET,
  arguments: process.argv.slice(2),
  databasePath: environment.DATABASE_PATH,
  projectDirectory,
});

const backupDirectory = resolve(
  projectDirectory,
  ".local",
  "development-backups",
);
mkdirSync(backupDirectory, { recursive: true });

if (existsSync(databasePath)) {
  const timestamp = new Date().toISOString().replaceAll(":", "-");
  const backupPath = resolve(
    backupDirectory,
    `${basename(databasePath)}.${timestamp}.backup`,
  );
  const existing = createDatabase(databasePath);
  try {
    await existing.sqlite.backup(backupPath);
  } finally {
    existing.close();
  }
}

for (const file of [
  databasePath,
  `${databasePath}-wal`,
  `${databasePath}-shm`,
]) {
  if (existsSync(file)) unlinkSync(file);
}

const replacement = createDatabase(databasePath);
try {
  migrate(replacement.db, {
    migrationsFolder: resolve(projectDirectory, "drizzle"),
  });
} finally {
  replacement.close();
}

console.log(
  `Instância de desenvolvimento/teste resetada. Para repetir, mantenha a confirmação ${DEVELOPMENT_RESET_ENV_VALUE}.`,
);
