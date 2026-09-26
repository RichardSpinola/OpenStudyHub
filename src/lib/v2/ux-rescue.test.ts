import { copyFileSync, mkdtempSync, readdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import sharp from "sharp";
import { afterEach, describe, expect, it, vi } from "vitest";
import { adminActor, userActor } from "./actor";
import { migrateV2, openV2Database, V2_MIGRATIONS } from "./database";
import { seedV2Fake } from "./fixtures";
import { deleteV2User, previewDeleteV2User } from "./users";

const fake = vi.hoisted(() => ({ root: "" }));
vi.mock("@/lib/env", () => ({
  getServerEnvironment: () => ({ PRIVATE_ASSET_PATH: fake.root }),
}));
vi.mock("@/lib/academic", () => ({
  listSubjectOfferings: () => [
    { offeringId: 9001, subjectName: "Fundamentos Fictícios" },
  ],
}));
import {
  coverForLegacyOffering,
  linkLegacyOffering,
  offeringCoverLimitBytes,
  removeOfferingCover,
  saveOfferingCover,
} from "./offering-covers";

const folders: string[] = [];
afterEach(() => {
  for (const folder of folders)
    rmSync(folder, { recursive: true, force: true });
  folders.length = 0;
});

describe("UX Rescue: segurança e migração", () => {
  it("exclui somente conta sem vínculos; bloqueia bridge e histórico", () => {
    const db = openV2Database(":memory:");
    try {
      migrateV2(db);
      seedV2Fake(db);
      db.prepare(
        "INSERT INTO users(id,login,display_name,password_hash) VALUES(99,'extra.fake','Conta Fictícia','FAKE')",
      ).run();
      expect(previewDeleteV2User(db, adminActor(1), 99).canDelete).toBe(true);
      expect(() => deleteV2User(db, adminActor(1), 99, "wrong")).toThrow();
      db.prepare(
        "INSERT INTO legacy_user_links(user_id,legacy_user_id) VALUES(99,9001)",
      ).run();
      expect(
        previewDeleteV2User(db, adminActor(1), 99).dependencies.some(
          (item) => item.table === "legacy_user_links",
        ),
      ).toBe(true);
      expect(() => deleteV2User(db, adminActor(1), 99, "extra.fake")).toThrow(
        "vínculo",
      );
      db.prepare("DELETE FROM legacy_user_links WHERE user_id=99").run();
      db.prepare(
        "INSERT INTO enrollments(user_id,offering_id,source) VALUES(99,1,'exception')",
      ).run();
      expect(() => deleteV2User(db, adminActor(1), 99, "extra.fake")).toThrow(
        "vínculo",
      );
      db.prepare("DELETE FROM enrollments WHERE user_id=99").run();
      deleteV2User(db, adminActor(1), 99, "extra.fake");
      expect(
        db.prepare("SELECT 1 FROM users WHERE id=99").get(),
      ).toBeUndefined();
      expect(db.pragma("foreign_key_check")).toEqual([]);
    } finally {
      db.close();
    }
  });

  it("exige grant na capa e Admin na ligação manual V1/V2", async () => {
    const folder = mkdtempSync(join(tmpdir(), "osh-covers-fake-"));
    folders.push(folder);
    fake.root = join(folder, "assets");
    const db = openV2Database(":memory:");
    try {
      migrateV2(db);
      seedV2Fake(db);
      const image = await sharp({
        create: { width: 40, height: 20, channels: 3, background: "#445566" },
      })
        .png()
        .toBuffer();
      await expect(
        saveOfferingCover(db, userActor(3), 1, image),
      ).rejects.toThrow("Sem permissão");
      await expect(
        saveOfferingCover(db, userActor(2), 4, image),
      ).rejects.toThrow("Sem permissão");
      await expect(
        saveOfferingCover(
          db,
          adminActor(1),
          1,
          Buffer.alloc(offeringCoverLimitBytes + 1),
        ),
      ).rejects.toThrow("5 MiB");
      await saveOfferingCover(db, userActor(2), 1, image);
      expect(() => linkLegacyOffering(db, userActor(2), 1, 9001)).toThrow(
        "Admin",
      );
      linkLegacyOffering(db, adminActor(1), 1, 9001);
      expect(coverForLegacyOffering(db, 9001)?.mimeType).toBe("image/png");
      expect(coverForLegacyOffering(db, 1)).toBeUndefined(); // numeric IDs are never matched implicitly.
      await removeOfferingCover(db, userActor(2), 1);
      expect(coverForLegacyOffering(db, 9001)).toBeUndefined();
      expect(
        db.prepare("SELECT 1 FROM offerings WHERE id=1").get(),
      ).toBeTruthy();
    } finally {
      db.close();
    }
  });

  it("migra wallpapers existentes sem perder a escolha e aceita 10 MiB no schema", () => {
    const folder = mkdtempSync(join(tmpdir(), "osh-v2-migrations-fake-"));
    folders.push(folder);
    for (const name of readdirSync(V2_MIGRATIONS).filter((name) =>
      /^000\d_.*\.sql$/.test(name),
    ))
      copyFileSync(join(V2_MIGRATIONS, name), join(folder, name));
    const db = openV2Database(":memory:");
    try {
      migrateV2(db, folder);
      db.prepare(
        "INSERT INTO users(id,login,display_name,password_hash) VALUES(99,'wallpaper.fake','Wallpaper Fictício','FAKE')",
      ).run();
      db.prepare(
        "INSERT INTO user_home_wallpapers(id,user_id,storage_name,mime_type,size_bytes,created_at) VALUES(41,99,'fake.png','image/png',100,1)",
      ).run();
      db.prepare(
        "INSERT INTO user_home_background_choice(user_id,preset,selected_wallpaper_id,updated_at) VALUES(99,'none',41,1)",
      ).run();
      migrateV2(db);
      expect(
        (
          db
            .prepare(
              "SELECT selected_wallpaper_id id FROM user_home_background_choice WHERE user_id=99",
            )
            .get() as { id: number }
        ).id,
      ).toBe(41);
      db.prepare(
        "INSERT INTO user_home_wallpapers(user_id,storage_name,mime_type,size_bytes,created_at) VALUES(99,'fake-large.png','image/png',10485760,2)",
      ).run();
      expect(() =>
        db
          .prepare(
            "INSERT INTO user_home_wallpapers(user_id,storage_name,mime_type,size_bytes,created_at) VALUES(99,'fake-too-large.png','image/png',10485761,2)",
          )
          .run(),
      ).toThrow();
      expect(db.pragma("integrity_check", { simple: true })).toBe("ok");
      expect(db.pragma("foreign_key_check")).toEqual([]);
    } finally {
      db.close();
    }
  });
});
