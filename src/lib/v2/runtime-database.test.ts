import { it, expect, vi } from "vitest";
import { mkdtempSync, rmSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  closeRuntimeV2Database,
  withV2Db,
  withV2DbAsync,
} from "./runtime-database";
it("reuses a migrated canonical connection and reconnects after an offline replacement", async () => {
  const dir = mkdtempSync(join(tmpdir(), "osh-runtime-")),
    path = join(dir, "v2.db");
  vi.stubEnv("OPENSTUDYHUB_V2_ENABLED", "1");
  vi.stubEnv("OPENSTUDYHUB_V2_DATABASE_PATH", path);
  vi.stubEnv("DATABASE_PATH", join(dir, "not-created.db"));
  try {
    const first = withV2Db((db) => db);
    expect(withV2Db((db) => db)).toBe(first);
    expect(await withV2DbAsync(async (db) => db)).toBe(first);
    expect(
      first.prepare("SELECT count(*) n FROM v2_migration_log").get(),
    ).toEqual({ n: 32 });
    closeRuntimeV2Database();
    unlinkSync(path);
    const next = withV2Db((db) => db);
    expect(next).not.toBe(first);
    expect(first.open).toBe(false);
  } finally {
    closeRuntimeV2Database();
    vi.unstubAllEnvs();
    rmSync(dir, { recursive: true, force: true });
  }
});
