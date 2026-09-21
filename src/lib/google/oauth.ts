import { createHash, randomBytes } from "node:crypto";
import { z } from "zod";

import type { DatabaseConnection } from "@/lib/db/client";
import { getDatabase } from "@/lib/db/client";

import {
  getGoogleRefreshToken,
  markGoogleConnectionRevoked,
  removeGoogleConnection,
  storeGoogleConnection,
} from "./connections";
import {
  getGoogleIntegrationAvailability,
  GOOGLE_OAUTH_SCOPES,
  requireGoogleIntegrationConfig,
  type GoogleIntegrationConfig,
} from "./config";
import { decryptSecret, encryptSecret } from "./crypto";

const OAUTH_STATE_DURATION_MS = 10 * 60 * 1000;
const GOOGLE_AUTHORIZATION_ENDPOINT =
  "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
const GOOGLE_USERINFO_ENDPOINT =
  "https://openidconnect.googleapis.com/v1/userinfo";
const GOOGLE_REVOCATION_ENDPOINT = "https://oauth2.googleapis.com/revoke";
const idSchema = z.number().int().positive();
const tokenResponseSchema = z.object({
  access_token: z.string().min(1),
  expires_in: z.number().int().positive().optional(),
  refresh_token: z.string().min(1).optional(),
  scope: z.string().optional(),
  token_type: z.string().optional(),
});
const userInfoSchema = z.object({
  sub: z.string().min(1).max(255),
  email: z.email().max(320),
});

export type GoogleFetch = typeof fetch;

function stateHash(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function codeChallenge(verifier: string): string {
  return createHash("sha256").update(verifier).digest("base64url");
}

async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

export function createGoogleAuthorizationUrl(
  userId: number,
  connection: DatabaseConnection = getDatabase(),
  config: GoogleIntegrationConfig = requireGoogleIntegrationConfig(),
  now = Date.now(),
): string {
  const ownerId = idSchema.parse(userId);
  const state = randomBytes(32).toString("base64url");
  const verifier = randomBytes(64).toString("base64url");
  connection.sqlite.transaction(() => {
    connection.sqlite
      .prepare("delete from google_oauth_states where expires_at <= ?")
      .run(now);
    connection.sqlite
      .prepare(
        `insert into google_oauth_states
         (state_hash, user_id, encrypted_code_verifier, expires_at, created_at)
         values (?, ?, ?, ?, ?)`,
      )
      .run(
        stateHash(state),
        ownerId,
        encryptSecret(verifier, config.encryptionKey),
        now + OAUTH_STATE_DURATION_MS,
        now,
      );
  })();

  const url = new URL(GOOGLE_AUTHORIZATION_ENDPOINT);
  url.searchParams.set("client_id", config.clientId);
  url.searchParams.set("redirect_uri", config.redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", GOOGLE_OAUTH_SCOPES.join(" "));
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("prompt", "consent");
  url.searchParams.set("include_granted_scopes", "true");
  url.searchParams.set("state", state);
  url.searchParams.set("code_challenge", codeChallenge(verifier));
  url.searchParams.set("code_challenge_method", "S256");
  return url.toString();
}

function consumeOauthState(
  userId: number,
  state: string,
  config: GoogleIntegrationConfig,
  connection: DatabaseConnection,
  now: number,
): string {
  const ownerId = idSchema.parse(userId);
  if (!state || state.length > 512) throw new Error("Invalid OAuth state.");
  const hashedState = stateHash(state);
  const stored = connection.sqlite
    .prepare(
      `select encrypted_code_verifier as encryptedCodeVerifier
       from google_oauth_states
       where state_hash = ? and user_id = ? and expires_at > ?`,
    )
    .get(hashedState, ownerId, now) as
    { encryptedCodeVerifier: string } | undefined;
  if (!stored) throw new Error("Invalid OAuth state.");
  const deleted = connection.sqlite
    .prepare(
      "delete from google_oauth_states where state_hash = ? and user_id = ?",
    )
    .run(hashedState, ownerId);
  if (deleted.changes !== 1) throw new Error("Invalid OAuth state.");
  return decryptSecret(stored.encryptedCodeVerifier, config.encryptionKey);
}

export async function completeGoogleAuthorization(
  userId: number,
  code: string,
  state: string,
  options: {
    connection?: DatabaseConnection;
    config?: GoogleIntegrationConfig;
    fetchImpl?: GoogleFetch;
    now?: number;
  } = {},
): Promise<void> {
  const connection = options.connection ?? getDatabase();
  const config = options.config ?? requireGoogleIntegrationConfig();
  const fetchImpl = options.fetchImpl ?? fetch;
  const verifier = consumeOauthState(
    userId,
    state,
    config,
    connection,
    options.now ?? Date.now(),
  );
  if (!code || code.length > 4096) throw new Error("Invalid OAuth response.");

  const tokenResponse = await fetchImpl(GOOGLE_TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      code,
      code_verifier: verifier,
      grant_type: "authorization_code",
      redirect_uri: config.redirectUri,
    }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!tokenResponse.ok) throw new Error("Google authorization failed.");
  const tokens = tokenResponseSchema.parse(await readJson(tokenResponse));
  if (!tokens.refresh_token) {
    throw new Error("Google authorization did not return offline access.");
  }

  const userInfoResponse = await fetchImpl(GOOGLE_USERINFO_ENDPOINT, {
    headers: { authorization: `Bearer ${tokens.access_token}` },
    signal: AbortSignal.timeout(15_000),
  });
  if (!userInfoResponse.ok) throw new Error("Google account lookup failed.");
  const userInfo = userInfoSchema.parse(await readJson(userInfoResponse));
  storeGoogleConnection(
    userId,
    {
      googleSubject: userInfo.sub,
      accountEmail: userInfo.email,
      refreshToken: tokens.refresh_token,
      grantedScopes: (tokens.scope ?? GOOGLE_OAUTH_SCOPES.join(" "))
        .split(" ")
        .filter(Boolean),
    },
    config.encryptionKey,
    connection,
  );
}

export async function getGoogleAccessToken(
  userId: number,
  options: {
    connection?: DatabaseConnection;
    config?: GoogleIntegrationConfig;
    fetchImpl?: GoogleFetch;
  } = {},
): Promise<string> {
  const connection = options.connection ?? getDatabase();
  const config = options.config ?? requireGoogleIntegrationConfig();
  const refreshToken = getGoogleRefreshToken(
    userId,
    config.encryptionKey,
    connection,
  );
  const response = await (options.fetchImpl ?? fetch)(GOOGLE_TOKEN_ENDPOINT, {
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
  const body = await readJson(response);
  if (!response.ok) {
    if (
      response.status === 400 &&
      z.object({ error: z.string() }).safeParse(body).data?.error ===
        "invalid_grant"
    ) {
      markGoogleConnectionRevoked(userId, connection);
    }
    throw new Error("Google access is unavailable.");
  }
  return tokenResponseSchema.parse(body).access_token;
}

export async function disconnectGoogleAccount(
  userId: number,
  options: {
    connection?: DatabaseConnection;
    fetchImpl?: GoogleFetch;
    config?: GoogleIntegrationConfig | null;
  } = {},
): Promise<void> {
  const connection = options.connection ?? getDatabase();
  const availability = getGoogleIntegrationAvailability();
  const config =
    options.config === undefined
      ? availability.configured
        ? availability.config
        : null
      : options.config;
  if (config) {
    try {
      const refreshToken = getGoogleRefreshToken(
        userId,
        config.encryptionKey,
        connection,
      );
      await (options.fetchImpl ?? fetch)(GOOGLE_REVOCATION_ENDPOINT, {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ token: refreshToken }),
        signal: AbortSignal.timeout(15_000),
      });
    } catch {
      // Local removal is deliberately fail-safe when Google is unavailable.
    }
  }
  removeGoogleConnection(userId, connection);
}
