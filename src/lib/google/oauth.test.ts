import { randomBytes } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { DatabaseConnection } from "@/lib/db/client";
import { createMigratedTestDatabase } from "@/lib/test-database";
import { openV2Database, migrateV2 } from "@/lib/v2/database";
import { DRIVE_SCOPE } from "@/lib/v2/google-config";

import type { GoogleIntegrationConfig } from "./config";
import { encryptSecret } from "./crypto";
import { ensureDriveRootFolder } from "./drive";
import { isConfiguredDriveStorageAvailable } from "./storage-owner";
import {
  completeGoogleAuthorization,
  createGoogleAuthorizationUrl,
  disconnectGoogleAccount,
  getGoogleAccessToken,
} from "./oauth";

function createUser(connection: DatabaseConnection, login: string): number {
  const now = Date.now();
  return Number(
    connection.sqlite
      .prepare(
        `insert into users
         (display_name, login, password_hash, role, active,
          password_changed_at, created_at, updated_at)
         values (?, ?, 'hash', 'member', 1, ?, ?, ?)`,
      )
      .run(login, login, now, now, now).lastInsertRowid,
  );
}

describe("Google OAuth", () => {
  let connection: DatabaseConnection;
  let config: GoogleIntegrationConfig;

  beforeEach(() => {
    connection = createMigratedTestDatabase();
    config = {
      clientId: "client-id",
      clientSecret: "client-secret",
      redirectUri: "http://localhost:3000/api/google/callback",
      encryptionKey: randomBytes(32),
    };
  });

  afterEach(() => connection.close());

  it("não reutiliza OAuth legado quando a identidade V2 está ativa", async () => {
    const previous = process.env.OPENSTUDYHUB_V2_ENABLED;
    process.env.OPENSTUDYHUB_V2_ENABLED = "1";
    try {
      const userId = createUser(connection, "legacy-google-user");
      expect(() =>
        createGoogleAuthorizationUrl(userId, connection, config),
      ).toThrow("V2");
      await expect(
        getGoogleAccessToken(userId, { connection, config }),
      ).rejects.toThrow("V2");
    } finally {
      if (previous === undefined) delete process.env.OPENSTUDYHUB_V2_ENABLED;
      else process.env.OPENSTUDYHUB_V2_ENABLED = previous;
    }
  });

  it("usa a conexão Drive V2 para o fluxo legado de projetos", async () => {
    const directory = mkdtempSync(join(tmpdir(), "osh-v2-drive-bridge-"));
    const databasePath = join(directory, "v2.db");
    const previousEnabled = process.env.OPENSTUDYHUB_V2_ENABLED;
    const previousPath = process.env.OPENSTUDYHUB_V2_DATABASE_PATH;
    const previousLegacyPath = process.env.DATABASE_PATH;
    const userId = createUser(connection, "drive-bridge-user");
    const key = randomBytes(32);
    const db = openV2Database(databasePath);
    try {
      migrateV2(db);
      db.prepare(
        "INSERT INTO users(id,login,display_name,password_hash) VALUES(1,'drive-bridge-user','Bridge','hash')",
      ).run();
      db.prepare(
        "INSERT INTO legacy_user_links(user_id,legacy_user_id) VALUES(1,?)",
      ).run(userId);
      db.prepare(
        `INSERT INTO google_connections_v2
         (user_id,google_subject,encrypted_refresh_token,scopes,status,updated_at)
         VALUES(1,'fake-sub',?,?,'connected',?)`,
      ).run(encryptSecret("fake-refresh", key), DRIVE_SCOPE, Date.now());
      db.prepare(
        "INSERT INTO storage_backends(kind,name,owner_user_id,state) VALUES('google-drive','Central Drive',1,'ready')",
      ).run();
      db.close();
      process.env.OPENSTUDYHUB_V2_ENABLED = "1";
      process.env.OPENSTUDYHUB_V2_DATABASE_PATH = databasePath;
      process.env.DATABASE_PATH = join(directory, "legacy.db");
      expect(isConfiguredDriveStorageAvailable(connection)).toBe(true);
      const fetchImpl = vi
        .fn<typeof fetch>()
        .mockResolvedValue(Response.json({ access_token: "fake-access" }));
      await expect(
        getGoogleAccessToken(userId, {
          connection,
          config: { ...config, encryptionKey: key },
          fetchImpl,
        }),
      ).resolves.toBe("fake-access");
      expect(fetchImpl).toHaveBeenCalledTimes(1);
      const rootFetch = vi.fn<typeof fetch>(async (input) =>
        String(input).includes("oauth2.googleapis.com")
          ? Response.json({ access_token: "fake-access" })
          : Response.json({ id: "fake-root" }),
      );
      await expect(
        ensureDriveRootFolder(userId, {
          connection,
          fetchImpl: rootFetch,
          v2Config: { ...config, encryptionKey: key },
        }),
      ).resolves.toMatchObject({ id: "fake-root" });
      const verify = openV2Database(databasePath);
      try {
        expect(
          (
            verify
              .prepare("SELECT root_ref ref FROM storage_backends")
              .get() as { ref: string }
          ).ref,
        ).toBe("fake-root");
      } finally {
        verify.close();
      }
    } finally {
      if (db.open) db.close();
      if (previousEnabled === undefined)
        delete process.env.OPENSTUDYHUB_V2_ENABLED;
      else process.env.OPENSTUDYHUB_V2_ENABLED = previousEnabled;
      if (previousPath === undefined)
        delete process.env.OPENSTUDYHUB_V2_DATABASE_PATH;
      else process.env.OPENSTUDYHUB_V2_DATABASE_PATH = previousPath;
      if (previousLegacyPath === undefined) delete process.env.DATABASE_PATH;
      else process.env.DATABASE_PATH = previousLegacyPath;
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it("usa state descartável, PKCE e armazena refresh token cifrado", async () => {
    const userId = createUser(connection, "oauth-user");
    const authorizationUrl = new URL(
      createGoogleAuthorizationUrl(userId, connection, config, 1_000),
    );
    const state = authorizationUrl.searchParams.get("state")!;
    expect(authorizationUrl.searchParams.get("code_challenge_method")).toBe(
      "S256",
    );
    expect(authorizationUrl.searchParams.get("access_type")).toBe("offline");

    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        Response.json({
          access_token: "short-lived-access",
          refresh_token: "private-refresh-token",
          scope: "openid email",
        }),
      )
      .mockResolvedValueOnce(
        Response.json({ sub: "google-subject", email: "user@example.test" }),
      );
    await completeGoogleAuthorization(userId, "authorization-code", state, {
      connection,
      config,
      fetchImpl,
      now: 2_000,
    });

    const stored = connection.sqlite
      .prepare(
        `select encrypted_refresh_token as encryptedRefreshToken
         from google_connections where user_id = ?`,
      )
      .get(userId) as { encryptedRefreshToken: string };
    expect(stored.encryptedRefreshToken).not.toContain("private-refresh-token");
    await expect(
      completeGoogleAuthorization(userId, "authorization-code", state, {
        connection,
        config,
        fetchImpl,
        now: 2_000,
      }),
    ).rejects.toThrow("Invalid OAuth state.");
  });

  it("não permite que outro usuário consuma o state", async () => {
    const ownerId = createUser(connection, "state-owner");
    const otherId = createUser(connection, "state-other");
    const state = new URL(
      createGoogleAuthorizationUrl(ownerId, connection, config, 1_000),
    ).searchParams.get("state")!;
    const fetchImpl = vi.fn<typeof fetch>();

    await expect(
      completeGoogleAuthorization(otherId, "code", state, {
        connection,
        config,
        fetchImpl,
        now: 2_000,
      }),
    ).rejects.toThrow("Invalid OAuth state.");
    expect(
      connection.sqlite
        .prepare("select count(*) as count from google_oauth_states")
        .get(),
    ).toEqual({ count: 1 });
  });

  it("revoga localmente apenas quando o refresh falha com invalid_grant", async () => {
    const userId = createUser(connection, "refresh-user");
    const now = Date.now();
    connection.sqlite
      .prepare(
        `insert into google_connections
         (user_id, google_subject, account_email, encrypted_refresh_token,
          granted_scopes, status, connected_at, updated_at)
         values (?, 'refresh-subject', 'refresh@example.test', ?, 'openid',
                 'connected', ?, ?)`,
      )
      .run(
        userId,
        (await import("./crypto")).encryptSecret(
          "private-refresh-token",
          config.encryptionKey,
        ),
        now,
        now,
      );
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        Response.json({ error: "invalid_grant" }, { status: 400 }),
      );

    await expect(
      getGoogleAccessToken(userId, { connection, config, fetchImpl }),
    ).rejects.toThrow("Google access is unavailable.");
    expect(
      connection.sqlite
        .prepare(
          `select status, encrypted_refresh_token as token
           from google_connections where user_id = ?`,
        )
        .get(userId),
    ).toEqual({ status: "revoked", token: null });
  });

  it("bloqueia usuário desconectado antes de chamar o provedor", async () => {
    const userId = createUser(connection, "disconnected-user");
    const fetchImpl = vi.fn<typeof fetch>();
    await expect(
      getGoogleAccessToken(userId, { connection, config, fetchImpl }),
    ).rejects.toThrow("Google account is not connected.");
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("desconecta somente o próprio usuário mesmo sem configuração ou auditoria", async () => {
    const userId = createUser(connection, "disconnect-user");
    const otherId = createUser(connection, "disconnect-other");
    const now = Date.now();
    const insert = connection.sqlite.prepare(
      `insert into google_connections
       (user_id, google_subject, account_email, encrypted_refresh_token,
        granted_scopes, status, connected_at, updated_at)
       values (?, ?, ?, 'encrypted-placeholder', 'openid', 'connected', ?, ?)`,
    );
    insert.run(userId, "disconnect-subject", "user@example.test", now, now);
    insert.run(otherId, "other-subject", "other@example.test", now, now);
    connection.sqlite.exec("drop table audit_events");

    await disconnectGoogleAccount(userId, { connection, config: null });

    expect(
      connection.sqlite
        .prepare(
          "select user_id as userId from google_connections order by user_id",
        )
        .all(),
    ).toEqual([{ userId: otherId }]);
  });
});
