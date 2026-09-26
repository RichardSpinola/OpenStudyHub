import { mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import sharp from "sharp";
import { describe, expect, it, vi } from "vitest";

import type { V2Database } from "@/lib/v2/database";
import { migrateV2, openV2Database } from "@/lib/v2/database";

const fake = vi.hoisted(() => ({
  db: null as unknown as V2Database,
  root: "",
}));
vi.mock("@/lib/v2/runtime", () => ({
  withV2Db: (fn: (db: V2Database) => unknown) => fn(fake.db),
  withV2DbAsync: async (fn: (db: V2Database) => Promise<unknown>) =>
    fn(fake.db),
}));
vi.mock("@/lib/env", () => ({
  getServerEnvironment: () => ({ PRIVATE_ASSET_PATH: fake.root }),
}));

import {
  chooseWallpaper,
  getWallpaperCatalog,
  readWallpaper,
  removeWallpaper,
  uploadWallpaper,
} from "./home-wallpapers";

describe("private Home wallpapers", () => {
  it("retains only three recent images and rejects another user's reads or choices", async () => {
    const folder = mkdtempSync(join(tmpdir(), "osh-wallpaper-"));
    const previous = process.env.OPENSTUDYHUB_V2_ENABLED;
    const db = openV2Database(":memory:");
    fake.db = db;
    fake.root = join(folder, "assets");
    process.env.OPENSTUDYHUB_V2_ENABLED = "1";
    try {
      migrateV2(db);
      db.prepare(
        "INSERT INTO users(id,login,display_name,password_hash) VALUES(1,'a.fake','A','fake'),(2,'b.fake','B','fake')",
      ).run();
      db.prepare(
        "INSERT INTO legacy_user_links(user_id,legacy_user_id) VALUES(1,11),(2,22)",
      ).run();
      const first = await sharp({
        create: { width: 16, height: 16, channels: 3, background: "#2266aa" },
      })
        .png()
        .toBuffer();
      for (let index = 0; index < 4; index++) await uploadWallpaper(11, first);
      const catalog = getWallpaperCatalog(11);
      expect(catalog.wallpapers).toHaveLength(3);
      expect(catalog.selected).toBe(`custom:${catalog.wallpapers[0].id}`);
      expect(readdirSync(fake.root)).toHaveLength(3);
      const owned = catalog.wallpapers[0].id;
      expect(await readWallpaper(22, owned)).toBeNull();
      expect(() => chooseWallpaper(22, owned)).toThrow("indisponível");
      await expect(removeWallpaper(22, owned)).rejects.toThrow("indisponível");
      await removeWallpaper(11, owned);
      expect(getWallpaperCatalog(11).wallpapers).toHaveLength(2);
      expect(readdirSync(fake.root)).toHaveLength(2);
      expect(db.pragma("foreign_key_check")).toEqual([]);
    } finally {
      db.close();
      rmSync(folder, { recursive: true, force: true });
      if (previous === undefined) delete process.env.OPENSTUDYHUB_V2_ENABLED;
      else process.env.OPENSTUDYHUB_V2_ENABLED = previous;
    }
  });
});
