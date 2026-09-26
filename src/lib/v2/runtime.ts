import { cookies } from "next/headers";
import type { V2Database } from "./database";
import { sessionAdminV2, sessionUserV2 } from "./auth";
import { ADMIN_COOKIE, USER_COOKIE } from "./runtime-database";
export {
  ADMIN_COOKIE,
  USER_COOKIE,
  v2RuntimePath,
  withV2Db,
  withV2DbAsync,
} from "./runtime-database";

export async function readUserSessionTokenV2(): Promise<string | undefined> {
  return (await cookies()).get(USER_COOKIE)?.value;
}
export async function writeUserSessionV2(token: string): Promise<void> {
  (await cookies()).set(USER_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 604800,
  });
}
export async function clearUserSessionV2(): Promise<void> {
  (await cookies()).delete(USER_COOKIE);
}
export async function currentAdminV2(db: V2Database) {
  return sessionAdminV2(db, (await cookies()).get(ADMIN_COOKIE)?.value);
}
export async function currentUserV2(db: V2Database) {
  return sessionUserV2(db, await readUserSessionTokenV2());
}
