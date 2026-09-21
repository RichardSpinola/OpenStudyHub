import { cookies } from "next/headers";

import { getServerEnvironment } from "@/lib/env";

export const SESSION_COOKIE_NAME = "openstudyhub_session";

export function getSessionCookieOptions(
  expiresAt: number,
  production: boolean,
) {
  return {
    httpOnly: true,
    secure: production,
    sameSite: "lax" as const,
    path: "/",
    expires: new Date(expiresAt),
  };
}

function isProduction(): boolean {
  return getServerEnvironment().NODE_ENV === "production";
}

export async function readSessionCookie(): Promise<string | null> {
  return (await cookies()).get(SESSION_COOKIE_NAME)?.value ?? null;
}

export async function writeSessionCookie(
  token: string,
  expiresAt: number,
): Promise<void> {
  (await cookies()).set(
    SESSION_COOKIE_NAME,
    token,
    getSessionCookieOptions(expiresAt, isProduction()),
  );
}

export async function clearSessionCookie(): Promise<void> {
  (await cookies()).set(SESSION_COOKIE_NAME, "", {
    ...getSessionCookieOptions(0, isProduction()),
    maxAge: 0,
  });
}
