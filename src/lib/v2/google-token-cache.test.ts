import { it, expect, vi } from "vitest";
import { openV2Database, migrateV2 } from "./database";
import { encryptSecret } from "../google/crypto";
import { googleAccessTokenV2 } from "./google-oauth";
const config = {
  clientId: "fake-client",
  clientSecret: "fake-secret",
  redirectUri: "http://localhost/api/v2/google/callback",
  encryptionKey: Buffer.alloc(32, 7),
};
it("deduplicates refreshes, reuses unexpired tokens, and refuses a credential removed during refresh", async () => {
  const db = openV2Database(":memory:");
  migrateV2(db);
  db.prepare(
    "INSERT INTO users(id,login,display_name,password_hash) VALUES(1,'fake','Fake','hash')",
  ).run();
  const token = encryptSecret("fake-refresh", config.encryptionKey);
  db.prepare(
    "INSERT INTO google_connections_v2(user_id,google_subject,encrypted_refresh_token,scopes,status,updated_at) VALUES(1,'fake',?,'test','connected',1)",
  ).run(token);
  let release!: () => void,
    calls = 0;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  vi.stubGlobal("fetch", async () => {
    calls++;
    await gate;
    return Response.json({ access_token: "access-one", expires_in: 3600 });
  });
  try {
    const first = googleAccessTokenV2(db, 1, { config }),
      second = googleAccessTokenV2(db, 1, { config });
    release();
    expect(await first).toBe("access-one");
    expect(await second).toBe("access-one");
    expect(calls).toBe(1);
    expect(await googleAccessTokenV2(db, 1, { config })).toBe("access-one");
    expect(calls).toBe(1);
    db.prepare(
      "UPDATE google_connections_v2 SET encrypted_refresh_token=? WHERE user_id=1",
    ).run(encryptSecret("new-refresh", config.encryptionKey));
    let resolve!: () => void;
    const wait = new Promise<void>((r) => {
      resolve = r;
    });
    vi.stubGlobal("fetch", async () => {
      await wait;
      return Response.json({
        access_token: "must-not-return",
        expires_in: 3600,
      });
    });
    const pending = googleAccessTokenV2(db, 1, { config });
    db.prepare("DELETE FROM google_connections_v2 WHERE user_id=1").run();
    resolve();
    await expect(pending).rejects.toThrow("Reconecte");
  } finally {
    vi.unstubAllGlobals();
    db.close();
  }
});
