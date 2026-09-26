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

export function withV2Db<T>(fn: (db: V2Database) => T): T {
  const db = openV2Database(v2RuntimePath());
  try {
    migrateV2(db);
    return fn(db);
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
    return await fn(db);
  } finally {
    db.close();
  }
}
