import { existsSync } from "node:fs";
import { createDatabase } from "@/lib/db/client";
import { synchronizeAcademicProjection } from "./academic-projection";
import { resolve } from "node:path";
import { openV2Database, migrateV2, type V2Database } from "./database";

export const ADMIN_COOKIE = "openstudyhub_v2_admin_session";
const cookieNamespace = process.env.OPENSTUDYHUB_V2_COOKIE_NAMESPACE;
if (cookieNamespace && !/^[a-z0-9_]{1,32}$/iu.test(cookieNamespace))
  throw new Error("Invalid V2 cookie namespace.");
export const USER_COOKIE = cookieNamespace
  ? `openstudyhub_v2_user_session_${cookieNamespace}`
  : "openstudyhub_v2_user_session";

export function v2RuntimePath(): string {
  const path = process.env.OPENSTUDYHUB_V2_DATABASE_PATH;
  if (
    process.env.OPENSTUDYHUB_V2_ENABLED !== "1" ||
    !path ||
    !path.startsWith("/")
  )
    throw new Error("Área V2 não configurada neste ambiente.");
  const absolute = resolve(/* turbopackIgnore: true */ path);
  if (
    absolute ===
    resolve(
      /* turbopackIgnore: true */ process.env.DATABASE_PATH || "/dev/null",
    )
  )
    throw new Error("O banco V2 precisa ser separado do banco V1.");
  return absolute;
}

function reconcile(db: V2Database) {
  const path = process.env.DATABASE_PATH;
  if (process.env.OPENSTUDYHUB_V2_ENABLED !== "1" || !path || !existsSync(path))
    return;
  const state = db
    .prepare(
      "SELECT revision,applied_revision FROM academic_projection_state WHERE id=1",
    )
    .get() as { revision: number; applied_revision: number } | undefined;
  if (!state || state.revision === state.applied_revision) return;
  const legacy = createDatabase(path);
  try {
    if (
      legacy.sqlite
        .prepare("SELECT 1 FROM sqlite_master WHERE name='subject_offerings'")
        .get()
    )
      synchronizeAcademicProjection(db, legacy);
  } finally {
    legacy.close();
  }
}

export function withV2Db<T>(fn: (db: V2Database) => T): T {
  const db = openV2Database(v2RuntimePath());
  try {
    migrateV2(db);
    reconcile(db);
    const result = fn(db);
    reconcile(db);
    return result;
  } finally {
    db.close();
  }
}

export async function withV2DbAsync<T>(
  fn: (db: V2Database) => Promise<T>,
): Promise<T> {
  const db = openV2Database(v2RuntimePath());
  try {
    migrateV2(db);
    reconcile(db);
    const result = await fn(db);
    reconcile(db);
    return result;
  } finally {
    db.close();
  }
}
