import { it, expect, beforeAll, afterAll, vi } from "vitest";
import Database from "better-sqlite3";
import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  readFileSync,
  existsSync,
  rmSync,
  readdirSync,
} from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";
import { createMigratedTestDatabase } from "../test-database";
import { migrateV2, openV2Database } from "./database";
import { recoveryKey, decryptBackup } from "./backup-crypto";
import {
  backupConfig,
  backupRuns,
  saveBackupConfig,
  runEncryptedBackup,
  encryptedBackupPath,
  scheduleDay,
  tickBackupSchedule,
} from "./backup-service";
import { withBackupLease, backupMaintenanceActive } from "./maintenance";
import { closeRuntimeV2Database } from "./runtime-database";
import { encryptSecret } from "../google/crypto";
import { DRIVE_SCOPE } from "./google-config";
import { createManualBackup } from "./manual-backup";
const root = mkdtempSync(join(tmpdir(), "osh-backup-test-")),
  key = recoveryKey();
const v1 = join(root, "app.sqlite"),
  v2 = join(root, "canonical.sqlite"),
  assets = join(root, "private");
const name = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa.bin";
beforeAll(async () => {
  vi.stubEnv("OPENSTUDYHUB_V2_ENABLED", "1");
  vi.stubEnv("DATABASE_PATH", v1);
  vi.stubEnv("OPENSTUDYHUB_V2_DATABASE_PATH", v2);
  vi.stubEnv("PRIVATE_ASSET_PATH", assets);
  vi.stubEnv("APP_URL", "http://localhost:3000");
  vi.stubEnv("GOOGLE_CLIENT_ID", "fake-client");
  vi.stubEnv("GOOGLE_CLIENT_SECRET", "fake-secret");
  vi.stubEnv(
    "GOOGLE_REDIRECT_URI",
    "http://localhost:3000/api/v2/google/callback",
  );
  vi.stubEnv(
    "GOOGLE_TOKEN_ENCRYPTION_KEY",
    Buffer.alloc(32, 7).toString("base64"),
  );
  const legacy = createMigratedTestDatabase();
  legacy.sqlite
    .prepare(
      "insert into users(id,display_name,login,password_hash,role,active,password_changed_at,created_at,updated_at) values(1,'Teste','teste','fake','member',1,1,1,1)",
    )
    .run();
  legacy.sqlite
    .prepare(
      "insert into note_images(id,data,mime_type,width,height,created_at) values('image',?,'image/webp',1,1,1)",
    )
    .run(Buffer.from("note image stored in database"));
  await legacy.sqlite.backup(v1);
  legacy.close();
  const canonical = openV2Database(v2);
  migrateV2(canonical);
  canonical
    .prepare(
      "INSERT INTO users(id,login,display_name,password_hash) VALUES(1,'fake','Fake','hash')",
    )
    .run();
  canonical
    .prepare(
      "INSERT INTO google_connections_v2(user_id,google_subject,encrypted_refresh_token,scopes,status,updated_at) VALUES(1,'fake',?,?,'connected',1)",
    )
    .run(encryptSecret("fake-refresh", Buffer.alloc(32, 7)), DRIVE_SCOPE);
  canonical
    .prepare(
      "INSERT INTO storage_backends(kind,name,owner_user_id,state,root_ref) VALUES('google-drive','Central Drive',1,'ready','fake-root')",
    )
    .run();
  canonical.close();
  mkdirSync(join(assets, "chat"), { recursive: true });
  writeFileSync(join(assets, "chat", name), "binary attachment");
  mkdirSync(join(root, "local-assets"));
  writeFileSync(
    join(root, "local-assets", "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"),
    "local object",
  );
});
afterAll(() => {
  closeRuntimeV2Database();
  vi.unstubAllEnvs();
  rmSync(root, { recursive: true, force: true });
});
it("checks schedule time in the selected zone, validates setup, and preserves key on invalid configuration", () => {
  expect(
    scheduleDay(Date.parse("2026-10-15T05:59:00Z"), {
      timeZone: "America/Bahia",
      time: "03:00",
    }),
  ).toEqual({ day: "2026-10-15", due: false });
  expect(
    scheduleDay(Date.parse("2026-10-15T06:00:00Z"), {
      timeZone: "America/Bahia",
      time: "03:00",
    }).due,
  ).toBe(true);
  expect(() => saveBackupConfig({ time: "30:80" }, key)).toThrow();
  expect(() => saveBackupConfig({ timeZone: "Not/aZone" }, key)).toThrow();
  saveBackupConfig({ enabled: true, retention: 1 }, key);
  expect(backupConfig()).toMatchObject({
    enabled: true,
    retention: 1,
    time: "03:00",
  });
});
it("serializes jobs, releases maintenance after failure and prevents a second process from starting", async () => {
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const first = withBackupLease(async () => {
    expect(backupMaintenanceActive()).toBe(true);
    await gate;
  });
  await expect(withBackupLease(async () => undefined)).rejects.toThrow();
  release();
  await first;
  expect(backupMaintenanceActive()).toBe(false);
  await expect(
    withBackupLease(async () => {
      throw new Error("test");
    }),
  ).rejects.toThrow("test");
  expect(backupMaintenanceActive()).toBe(false);
});
it("exports both DBs, note image blobs and binary chat assets; validates and restores offline with rollback", async () => {
  const run = await runEncryptedBackup();
  expect(run.status).toBe("complete");
  const zip = join(root, "decrypted.zip");
  await decryptBackup(encryptedBackupPath(run.id), zip, key);
  const restoreRoot = join(root, "restored");
  mkdirSync(restoreRoot);
  const env = {
    ...process.env,
    DATABASE_PATH: join(restoreRoot, "app.db"),
    OPENSTUDYHUB_V2_DATABASE_PATH: join(restoreRoot, "v2.db"),
    PRIVATE_ASSET_PATH: join(restoreRoot, "assets"),
  };
  writeFileSync(env.DATABASE_PATH, "old database marker");
  writeFileSync(env.DATABASE_PATH + "-wal", "old WAL marker");
  const validate = spawnSync(
    process.execPath,
    ["scripts/restore-manual-backup.mjs", zip, "--validate-only"],
    { env, encoding: "utf8" },
  );
  expect(validate.status, validate.stderr).toBe(0);
  expect(readFileSync(env.DATABASE_PATH, "utf8")).toBe("old database marker");
  const restore = spawnSync(
    process.execPath,
    [
      "scripts/restore-manual-backup.mjs",
      zip,
      "--confirm-restore",
      "--services-stopped",
    ],
    { env, encoding: "utf8" },
  );
  expect(restore.status, restore.stderr).toBe(0);
  expect(readFileSync(join(env.PRIVATE_ASSET_PATH, "chat", name), "utf8")).toBe(
    "binary attachment",
  );
  expect(existsSync(env.DATABASE_PATH + "-wal")).toBe(false);
  expect(
    readdirSync(restoreRoot).some((n) => n.includes(".pre-restore-")),
  ).toBe(true);
  const restored = new Database(env.DATABASE_PATH, { readonly: true });
  expect(
    (
      restored
        .prepare("select data from note_images where id='image'")
        .get() as { data: Buffer }
    ).data.toString(),
  ).toContain("note image");
  restored.close();
}, 20000);
it("retains manual backups and only sweeps successful automatic copies; duplicate scheduled runs do not create copies", async () => {
  const manual = backupRuns().find((r) => r.kind === "manual")!;
  const first = await runEncryptedBackup("automatic", "2026-10-16");
  expect(first.status).toBe("complete");
  const second = await runEncryptedBackup("automatic", "2026-10-17");
  expect(second.status).toBe("complete");
  expect(existsSync(encryptedBackupPath(first.id))).toBe(false);
  expect(existsSync(encryptedBackupPath(second.id))).toBe(true);
  expect(existsSync(encryptedBackupPath(manual.id))).toBe(true);
  await expect(runEncryptedBackup("automatic", "2026-10-17")).rejects.toThrow(
    "já executado",
  );
  await tickBackupSchedule(Date.parse("2026-10-17T08:00:00Z"));
  expect(backupRuns().filter((r) => r.kind === "automatic")).toHaveLength(1);
}, 20000);
it("streams a protected package to the configured Drive and reports a failed remote copy without discarding the local copy", async () => {
  saveBackupConfig({ ...backupConfig(), destination: "local-drive" });
  let streamed = 0;
  vi.stubGlobal(
    "fetch",
    async (input: string | URL | Request, init?: RequestInit) => {
      if (String(input).includes("oauth2"))
        return Response.json({ access_token: "fake-access", expires_in: 3600 });
      if (init?.method === "POST")
        return new Response(null, {
          status: 200,
          headers: {
            location:
              "https://www.googleapis.com/upload/drive/v3/files?upload_id=fake",
          },
        });
      if (init?.method === "PUT") {
        for await (const chunk of init.body as unknown as AsyncIterable<Buffer>)
          streamed += chunk.length;
        return Response.json({ id: "fake-drive-backup" });
      }
      throw new Error("Unexpected network operation");
    },
  );
  try {
    const complete = await runEncryptedBackup();
    expect(complete.status).toBe("complete");
    expect(complete.driveId).toBe("fake-drive-backup");
    expect(streamed).toBeGreaterThan(0);
    vi.stubGlobal("fetch", async () => new Response(null, { status: 403 }));
    const partial = await runEncryptedBackup();
    expect(partial.status).toBe("local-only");
    expect(existsSync(encryptedBackupPath(partial.id))).toBe(true);
    expect(existsSync(encryptedBackupPath(complete.id))).toBe(true);
  } finally {
    vi.unstubAllGlobals();
    saveBackupConfig({ ...backupConfig(), destination: "local" });
  }
}, 20000);
it("rejects missing referenced assets and does not report a partial copy as success", async () => {
  const db = new Database(v1);
  db.prepare(
    "update users set avatar_storage_name='cccccccc-cccc-4ccc-8ccc-cccccccccccc.png' where id=1",
  ).run();
  db.close();
  await expect(createManualBackup()).rejects.toThrow("referenciado");
  expect(backupMaintenanceActive()).toBe(false);
  const run = await runEncryptedBackup();
  expect(run.status).toBe("error");
  expect(existsSync(encryptedBackupPath(run.id))).toBe(false);
}, 20000);
