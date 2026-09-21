import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { bootstrapFirstAdmin } from "@/lib/access";
import type { DatabaseConnection } from "@/lib/db/client";
import { getSessionCookieOptions } from "@/lib/session-cookie";
import { createMigratedTestDatabase } from "@/lib/test-database";

import {
  createSession,
  getSessionByToken,
  hashSessionToken,
  revokeSessionToken,
  SESSION_DURATION_MS,
} from "./session";

describe("sessões locais", () => {
  let connection: DatabaseConnection;
  let userId: number;

  beforeEach(async () => {
    connection = createMigratedTestDatabase();
    userId = (
      await bootstrapFirstAdmin(
        {
          displayName: "Administradora Teste",
          login: "admin.teste",
          password: "senha-local-forte-123",
          language: "pt-BR",
        },
        connection,
      )
    ).id;
  });

  afterEach(() => connection.close());

  it("persiste apenas o hash do token e respeita expiração absoluta", () => {
    const now = 1_900_000_000_000;
    const session = createSession(userId, connection, now);
    const stored = connection.sqlite
      .prepare("select token_hash as tokenHash from sessions")
      .get() as { tokenHash: string };

    expect(stored.tokenHash).toBe(hashSessionToken(session.token));
    expect(stored.tokenHash).not.toBe(session.token);
    expect(session.expiresAt).toBe(now + SESSION_DURATION_MS);
    expect(getSessionByToken(session.token, connection, now)).not.toBeNull();
    expect(
      getSessionByToken(session.token, connection, session.expiresAt),
    ).toBeNull();
  });

  it("recusa sessão revogada ou de usuário desativado", () => {
    const first = createSession(userId, connection);
    expect(revokeSessionToken(first.token, connection)).toBe(true);
    expect(getSessionByToken(first.token, connection)).toBeNull();

    const second = createSession(userId, connection);
    connection.sqlite
      .prepare("update users set active = 0 where id = ?")
      .run(userId);
    expect(getSessionByToken(second.token, connection)).toBeNull();
  });

  it("configura cookie HttpOnly, SameSite e Secure apenas em produção", () => {
    const development = getSessionCookieOptions(Date.now() + 1000, false);
    const production = getSessionCookieOptions(Date.now() + 1000, true);
    expect(development).toMatchObject({
      httpOnly: true,
      sameSite: "lax",
      secure: false,
      path: "/",
    });
    expect(production.secure).toBe(true);
  });
});
