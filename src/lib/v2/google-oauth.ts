import { createHash, randomBytes } from "node:crypto";
import { z } from "zod";
import { decryptSecret, encryptSecret } from "@/lib/google/crypto";
import type { V2Database } from "./database";
import {
  CLASSROOM_SCOPES,
  DRIVE_SCOPE,
  requireGoogleV2Config,
  type GoogleV2Config,
} from "./google-config";

const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const USERINFO_URL = "https://openidconnect.googleapis.com/v1/userinfo";
const REVOKE_URL = "https://oauth2.googleapis.com/revoke";
const tokenSchema = z.object({
  access_token: z.string().min(1),
  refresh_token: z.string().min(1).optional(),
  scope: z.string().optional(),
});
const userSchema = z.object({ sub: z.string().min(1), email: z.email() });
type GoogleFetch = typeof fetch;
type Options = {
  config?: GoogleV2Config;
  fetchImpl?: GoogleFetch;
  now?: number;
  onStage?: (
    stage:
      | "state"
      | "token_exchange"
      | "google_identity"
      | "refresh_token"
      | "classroom_scopes"
      | "save_connection",
  ) => void;
  onMissingClassroomScopes?: (missing: string[]) => void;
};
const hash = (value: string) =>
  createHash("sha256").update(value).digest("hex");
const pkce = (value: string) =>
  createHash("sha256").update(value).digest("base64url");

export function googleConnectionStatus(db: V2Database, userId: number) {
  return db
    .prepare(
      "SELECT status,scopes,updated_at updatedAt FROM google_connections_v2 WHERE user_id=?",
    )
    .get(userId) as
    | {
        status: "connected" | "needs_reconnect";
        scopes: string;
        updatedAt: number;
      }
    | undefined;
}

export function startGoogleV2(
  db: V2Database,
  userId: number,
  includeDrive = false,
  options: Options = {},
): string {
  const config = options.config ?? requireGoogleV2Config();
  if (!db.prepare("SELECT 1 FROM users WHERE id=? AND active=1").get(userId))
    throw new Error("Usuário indisponível.");
  const state = randomBytes(32).toString("base64url");
  const verifier = randomBytes(64).toString("base64url");
  const now = options.now ?? Date.now();
  db.transaction(() => {
    db.prepare("DELETE FROM google_oauth_states_v2 WHERE expires_at<=?").run(
      now,
    );
    db.prepare(
      "INSERT INTO google_oauth_states_v2(state_hash,user_id,encrypted_verifier,expires_at) VALUES(?,?,?,?)",
    ).run(
      hash(state),
      userId,
      encryptSecret(verifier, config.encryptionKey),
      now + 600_000,
    );
  })();
  const url = new URL(AUTH_URL);
  const scopes = includeDrive
    ? [...CLASSROOM_SCOPES, DRIVE_SCOPE]
    : [...CLASSROOM_SCOPES];
  for (const [key, value] of Object.entries({
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    response_type: "code",
    scope: scopes.join(" "),
    access_type: "offline",
    prompt: "consent",
    state,
    code_challenge: pkce(verifier),
    code_challenge_method: "S256",
  }))
    url.searchParams.set(key, value);
  return url.toString();
}

function consumeState(
  db: V2Database,
  userId: number,
  state: string,
  config: GoogleV2Config,
  now: number,
) {
  if (!state || state.length > 512) throw new Error("Estado OAuth inválido.");
  return db.transaction(() => {
    const row = db
      .prepare(
        "SELECT encrypted_verifier verifier FROM google_oauth_states_v2 WHERE state_hash=? AND user_id=? AND expires_at>?",
      )
      .get(hash(state), userId, now) as { verifier: string } | undefined;
    if (!row) throw new Error("Estado OAuth inválido ou expirado.");
    db.prepare("DELETE FROM google_oauth_states_v2 WHERE state_hash=?").run(
      hash(state),
    );
    return decryptSecret(row.verifier, config.encryptionKey);
  })();
}

export async function completeGoogleV2(
  db: V2Database,
  userId: number,
  code: string,
  state: string,
  options: Options = {},
): Promise<void> {
  const config = options.config ?? requireGoogleV2Config();
  const fetchImpl = options.fetchImpl ?? fetch;
  options.onStage?.("state");
  const verifier = consumeState(
    db,
    userId,
    state,
    config,
    options.now ?? Date.now(),
  );
  if (!code || code.length > 4096) throw new Error("Resposta OAuth inválida.");
  options.onStage?.("token_exchange");
  const response = await fetchImpl(TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      redirect_uri: config.redirectUri,
      grant_type: "authorization_code",
      code_verifier: verifier,
      code,
    }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw new Error("Autorização Google indisponível.");
  const tokens = tokenSchema.parse(await response.json());
  options.onStage?.("google_identity");
  const profileResponse = await fetchImpl(USERINFO_URL, {
    headers: { authorization: `Bearer ${tokens.access_token}` },
    signal: AbortSignal.timeout(15_000),
  });
  if (!profileResponse.ok) throw new Error("Identidade Google indisponível.");
  const profile = userSchema.parse(await profileResponse.json());
  options.onStage?.("refresh_token");
  const previous = db
    .prepare(
      "SELECT google_subject subject,encrypted_refresh_token token FROM google_connections_v2 WHERE user_id=?",
    )
    .get(userId) as { subject: string; token: string | null } | undefined;
  const refresh = tokens.refresh_token
    ? encryptSecret(tokens.refresh_token, config.encryptionKey)
    : previous?.subject === profile.sub
      ? previous.token
      : null;
  if (!refresh)
    throw new Error("Google não forneceu acesso offline. Reconecte a conta.");
  const other = db
    .prepare(
      "SELECT user_id id FROM google_connections_v2 WHERE google_subject=?",
    )
    .get(profile.sub) as { id: number } | undefined;
  if (other && other.id !== userId)
    throw new Error("Esta conta Google já está vinculada a outro usuário.");
  options.onStage?.("classroom_scopes");
  const scopes = [
    ...new Set(
      (tokens.scope ?? CLASSROOM_SCOPES.join(" ")).split(/\s+/).filter(Boolean),
    ),
  ];
  const scopeNames = ["cursos", "atividades", "materiais", "avisos"] as const;
  const missingClassroomScopes: string[] = [];
  CLASSROOM_SCOPES.slice(2).forEach((scope, index) => {
    const granted = scopes.includes(scope) ||
      (scopeNames[index] === "atividades" &&
        scopes.includes("https://www.googleapis.com/auth/classroom.student-submissions.me.readonly"));
    if (!granted) missingClassroomScopes.push(scopeNames[index]);
  });
  if (missingClassroomScopes.length) {
    options.onMissingClassroomScopes?.(missingClassroomScopes);
    throw new Error("Permissões Classroom insuficientes.");
  }
  options.onStage?.("save_connection");
  db.prepare(
    `INSERT INTO google_connections_v2(user_id,google_subject,encrypted_refresh_token,scopes,status,updated_at)
     VALUES(?,?,?,?,'connected',?)
     ON CONFLICT(user_id) DO UPDATE SET google_subject=excluded.google_subject,
       encrypted_refresh_token=excluded.encrypted_refresh_token,scopes=excluded.scopes,
       status='connected',updated_at=excluded.updated_at`,
  ).run(userId, profile.sub, refresh, scopes.join(" "), Date.now());
}

export async function googleAccessTokenV2(
  db: V2Database,
  userId: number,
  options: Options = {},
): Promise<string> {
  const config = options.config ?? requireGoogleV2Config();
  const row = db
    .prepare(
      "SELECT encrypted_refresh_token token FROM google_connections_v2 WHERE user_id=? AND status='connected'",
    )
    .get(userId) as { token: string | null } | undefined;
  if (!row?.token) throw new Error("Reconecte sua conta Google.");
  const refreshToken = decryptSecret(row.token, config.encryptionKey);
  const response = await (options.fetchImpl ?? fetch)(TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as {
      error?: string;
    };
    if (body.error === "invalid_grant") {
      db.prepare(
        "UPDATE google_connections_v2 SET encrypted_refresh_token=NULL,status='needs_reconnect',updated_at=? WHERE user_id=?",
      ).run(Date.now(), userId);
    }
    throw new Error(
      body.error === "invalid_grant"
        ? "Reconecte sua conta Google."
        : "Google temporariamente indisponível.",
    );
  }
  return tokenSchema.parse(await response.json()).access_token;
}

export async function disconnectGoogleV2(
  db: V2Database,
  userId: number,
  options: Options = {},
): Promise<void> {
  const row = db
    .prepare(
      "SELECT encrypted_refresh_token token FROM google_connections_v2 WHERE user_id=?",
    )
    .get(userId) as { token: string | null } | undefined;
  db.prepare("DELETE FROM google_oauth_states_v2 WHERE user_id=?").run(userId);
  db.prepare("DELETE FROM google_connections_v2 WHERE user_id=?").run(userId);
  db.prepare(
    "UPDATE classroom_sync_v2 SET status='needs_reconnect' WHERE user_id=?",
  ).run(userId);
  if (!row?.token) return;
  try {
    const config = options.config ?? requireGoogleV2Config();
    await (options.fetchImpl ?? fetch)(REVOKE_URL, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        token: decryptSecret(row.token, config.encryptionKey),
      }),
      signal: AbortSignal.timeout(15_000),
    });
  } catch {
    // Local credential removal succeeds even if remote revocation is unavailable.
  }
}
