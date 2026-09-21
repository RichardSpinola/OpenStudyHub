import { createHash, randomBytes } from "node:crypto";

import type { DatabaseConnection } from "@/lib/db/client";
import { getDatabase } from "@/lib/db/client";

export const SESSION_DURATION_MS = 8 * 60 * 60 * 1000;

export type AuthenticatedUser = {
  id: number;
  displayName: string;
  login: string;
  role: "admin" | "member";
};

export type SessionRecord = {
  id: number;
  user: AuthenticatedUser;
  expiresAt: number;
};

export function hashSessionToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function createSession(
  userId: number,
  connection: DatabaseConnection = getDatabase(),
  now = Date.now(),
): { token: string; expiresAt: number } {
  const token = randomBytes(32).toString("base64url");
  const tokenHash = hashSessionToken(token);
  const expiresAt = now + SESSION_DURATION_MS;

  connection.sqlite
    .prepare(
      `insert into sessions
       (user_id, token_hash, created_at, expires_at, revoked_at)
       values (?, ?, ?, ?, null)`,
    )
    .run(userId, tokenHash, now, expiresAt);

  return { token, expiresAt };
}

export function getSessionByToken(
  token: string,
  connection: DatabaseConnection = getDatabase(),
  now = Date.now(),
): SessionRecord | null {
  if (!token || token.length > 256) return null;

  const result = connection.sqlite
    .prepare(
      `select
         se.id as id,
         se.expires_at as expiresAt,
         u.id as userId,
         u.display_name as displayName,
         u.login as login,
         u.role as role
       from sessions se
       join users u on u.id = se.user_id
       where se.token_hash = ?
         and se.revoked_at is null
         and se.expires_at > ?
         and u.active = 1`,
    )
    .get(hashSessionToken(token), now) as
    | {
        id: number;
        expiresAt: number;
        userId: number;
        displayName: string;
        login: string;
        role: "admin" | "member";
      }
    | undefined;

  if (!result) return null;

  return {
    id: result.id,
    expiresAt: result.expiresAt,
    user: {
      id: result.userId,
      displayName: result.displayName,
      login: result.login,
      role: result.role,
    },
  };
}

export function revokeSessionToken(
  token: string,
  connection: DatabaseConnection = getDatabase(),
  now = Date.now(),
): boolean {
  if (!token || token.length > 256) return false;
  const result = connection.sqlite
    .prepare(
      `update sessions set revoked_at = ?
       where token_hash = ? and revoked_at is null`,
    )
    .run(now, hashSessionToken(token));
  return result.changes > 0;
}

export function revokeUserSessions(
  userId: number,
  connection: DatabaseConnection = getDatabase(),
  now = Date.now(),
): number {
  const result = connection.sqlite
    .prepare(
      `update sessions set revoked_at = ?
       where user_id = ? and revoked_at is null`,
    )
    .run(now, userId);
  return result.changes;
}

export function removeExpiredSessions(
  connection: DatabaseConnection = getDatabase(),
  now = Date.now(),
): number {
  return connection.sqlite
    .prepare(
      "delete from sessions where expires_at <= ? or revoked_at is not null",
    )
    .run(now).changes;
}
