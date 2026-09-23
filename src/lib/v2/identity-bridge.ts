import { getDatabase, type DatabaseConnection } from "@/lib/db/client";
import { authenticateLocalUser } from "@/lib/access";
import { verifyPassword } from "@/lib/password";
import { sessionUserV2, authenticateUserV2, revokeUserSessionV2 } from "./auth";
import type { V2Database } from "./database";
import { hashSessionToken, type SessionRecord } from "@/lib/session";

type LegacyRow = {
  id: number;
  login: string;
  display_name: string;
  password_hash: string;
  role: string;
  active: number;
};
type CanonicalRow = {
  id: number;
  login: string;
  display_name: string;
  password_hash: string;
  active: number;
};

function legacyByLogin(
  connection: DatabaseConnection,
  login: string,
): LegacyRow | undefined {
  return connection.sqlite
    .prepare(
      "SELECT id,login,display_name,password_hash,role,active FROM users WHERE lower(login)=?",
    )
    .get(login.toLowerCase()) as LegacyRow | undefined;
}

function link(db: V2Database, userId: number, legacyId: number): void {
  const existing = db
    .prepare("SELECT legacy_user_id id FROM legacy_user_links WHERE user_id=?")
    .get(userId) as { id: number } | undefined;
  if (existing) {
    if (existing.id !== legacyId)
      throw new Error("Vínculo legado conflitante.");
    return;
  }
  db.prepare(
    "INSERT INTO legacy_user_links(user_id,legacy_user_id) VALUES(?,?)",
  ).run(userId, legacyId);
}

// Called after authenticating the V2 password. A matching legacy login is never
// claimed without checking its password; ID equality has no meaning here.
export async function ensureLegacyLink(
  db: V2Database,
  userId: number,
  password: string,
  connection: DatabaseConnection = getDatabase(),
): Promise<number> {
  const row = db
    .prepare(
      "SELECT id,login,display_name,password_hash,active FROM users WHERE id=?",
    )
    .get(userId) as CanonicalRow | undefined;
  if (!row?.active) throw new Error("Usuário indisponível.");
  const current = db
    .prepare("SELECT legacy_user_id id FROM legacy_user_links WHERE user_id=?")
    .get(userId) as { id: number } | undefined;
  if (current) return current.id;
  let legacy = legacyByLogin(connection, row.login);
  if (legacy) {
    if (
      !legacy.active ||
      legacy.role !== "member" ||
      !(await verifyPassword(legacy.password_hash, password))
    )
      throw new Error(
        "Conta legada com mesmo login exige revisão de identidade.",
      );
  } else {
    const id = Number(
      connection.sqlite
        .prepare(
          "INSERT INTO users(display_name,login,password_hash,role,active,onboarding_version) VALUES(?,?,?,'member',1,0)",
        )
        .run(row.display_name, row.login, row.password_hash).lastInsertRowid,
    );
    legacy = legacyByLogin(connection, row.login);
    if (!legacy || legacy.id !== id)
      throw new Error("Falha ao criar ponte legada.");
  }
  link(db, userId, legacy.id);
  return legacy.id;
}

// A V1 member can enter once and acquire a V2 session. Its compatible Argon2id
// hash is copied into the canonical account; sessions and Google tokens are not.
export async function authenticateNormal(
  db: V2Database,
  login: string,
  password: string,
  connection: DatabaseConnection = getDatabase(),
): Promise<{ token: string; id: number } | null> {
  const normalized = login.trim().toLowerCase();
  const existing = db
    .prepare("SELECT id FROM users WHERE lower(login)=?")
    .get(normalized) as { id: number } | undefined;
  if (existing) {
    const result = await authenticateUserV2(db, normalized, password);
    if (!result) return null;
    try {
      await ensureLegacyLink(db, result.id, password, connection);
      return result;
    } catch (error) {
      revokeUserSessionV2(db, result.token);
      throw error;
    }
  }
  if (legacyByLogin(connection, normalized)?.role !== "member") return null;
  const legacy = await authenticateLocalUser(normalized, password, connection);
  if (!legacy || legacy.role !== "member") return null;
  const source = legacyByLogin(connection, normalized);
  if (!source || !source.active) return null;
  const userId = Number(
    db
      .prepare(
        "INSERT INTO users(login,display_name,password_hash) VALUES(?,?,?)",
      )
      .run(source.login, source.display_name, source.password_hash)
      .lastInsertRowid,
  );
  link(db, userId, source.id);
  return authenticateUserV2(db, normalized, password);
}

export function projectLegacySession(
  db: V2Database,
  token: string | undefined,
  connection: DatabaseConnection = getDatabase(),
): SessionRecord | null {
  const user = sessionUserV2(db, token);
  if (!user || user.mustChangePassword) return null;
  const canonicalSession = db
    .prepare(
      "SELECT id,expires_at expiresAt FROM user_sessions WHERE token_hash=? AND revoked_at IS NULL",
    )
    .get(hashSessionToken(token!)) as
    { id: number; expiresAt: number } | undefined;
  if (!canonicalSession) return null;
  const bridge = db
    .prepare("SELECT legacy_user_id id FROM legacy_user_links WHERE user_id=?")
    .get(user.id) as { id: number } | undefined;
  if (!bridge) return null;
  const row = connection.sqlite
    .prepare(
      "SELECT id,display_name name,login,active,role FROM users WHERE id=?",
    )
    .get(bridge.id) as
    | { id: number; name: string; login: string; active: number; role: string }
    | undefined;
  if (!row?.active || row.role !== "member") return null;
  return {
    id: canonicalSession.id,
    expiresAt: canonicalSession.expiresAt,
    user: {
      id: row.id,
      displayName: row.name,
      login: row.login,
      role: "member",
    },
  };
}

export function canonicalIdForLegacy(
  db: V2Database,
  legacyId: number,
): number | null {
  const row = db
    .prepare("SELECT user_id id FROM legacy_user_links WHERE legacy_user_id=?")
    .get(legacyId) as { id: number } | undefined;
  return row?.id ?? null;
}
