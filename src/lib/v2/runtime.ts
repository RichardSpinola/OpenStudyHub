import { resolve } from "node:path";
import { cookies } from "next/headers";
import { openV2Database, migrateV2, type V2Database } from "./database";
import { sessionAdminV2, sessionUserV2 } from "./auth";

export const ADMIN_COOKIE = "openstudyhub_v2_admin_session";
export const USER_COOKIE = "openstudyhub_v2_user_session";
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
export async function currentAdminV2(db: V2Database) {
  return sessionAdminV2(db, (await cookies()).get(ADMIN_COOKIE)?.value);
}
export async function currentUserV2(db: V2Database) {
  return sessionUserV2(db, (await cookies()).get(USER_COOKIE)?.value);
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
