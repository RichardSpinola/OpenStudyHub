import { describe, it, expect } from "vitest";
import sharp from "sharp";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createMigratedTestDatabase } from "./test-database";
import {
  normalizeShortcutUpload,
  saveShortcutImage,
  readShortcutIcon,
  shortcutImageLimit,
} from "./shortcut-icons";
import { createUserShortcut } from "./user-shortcuts";
describe("shortcut upload", () => {
  it("accepts a bounded raster, rejects oversized/invalid files and converts to small PNG", async () => {
    const data = await sharp({
      create: { width: 32, height: 32, channels: 4, background: "#445566" },
    })
      .webp()
      .toBuffer();
    const out = await normalizeShortcutUpload(data);
    expect((await sharp(out).metadata()).format).toBe("png");
    await expect(
      normalizeShortcutUpload(Buffer.alloc(shortcutImageLimit + 1)),
    ).rejects.toThrow("2 MB");
    await expect(
      normalizeShortcutUpload(Buffer.from("<svg></svg>")),
    ).rejects.toThrow("válido");
  });
  it("saved upload belongs only to its shortcut owner", async () => {
    const connection = createMigratedTestDatabase(),
      root = await mkdtemp(join(tmpdir(), "osh-icon-test-"));
    try {
      connection.sqlite
        .prepare(
          "INSERT INTO users(id,login,display_name,password_hash,role) VALUES(1,'a','A','fake','member'),(2,'b','B','fake','member')",
        )
        .run();
      const s = createUserShortcut(
        1,
        { name: "Teste", url: "https://example.test", icon: "@image" },
        connection,
      );
      const data = await sharp({
        create: { width: 12, height: 12, channels: 4, background: "#112233" },
      })
        .png()
        .toBuffer();
      await expect(
        saveShortcutImage("user", s.id, 2, data, {
          connection,
          assetRoot: root,
        }),
      ).rejects.toThrow("não encontrado");
      await saveShortcutImage("user", s.id, 1, data, {
        connection,
        assetRoot: root,
      });
      expect(
        await readShortcutIcon("user", s.id, 1, {
          connection,
          assetRoot: root,
        }),
      ).not.toBeNull();
      expect(
        await readShortcutIcon("user", s.id, 2, {
          connection,
          assetRoot: root,
        }),
      ).toBeNull();
    } finally {
      connection.close();
      await rm(root, { recursive: true, force: true });
    }
  });
  it("does not remove an inherited image still used by another shortcut", async () => {
    const connection = createMigratedTestDatabase(),
      root = await mkdtemp(join(tmpdir(), "osh-icon-shared-"));
    try {
      connection.sqlite
        .prepare(
          "INSERT INTO users(id,login,display_name,password_hash,role) VALUES(1,'a','A','fake','member'),(2,'b','B','fake','member')",
        )
        .run();
      const a = createUserShortcut(
          1,
          { name: "A", url: "https://example.test", icon: "@image" },
          connection,
        ),
        b = createUserShortcut(
          2,
          { name: "B", url: "https://example.test", icon: "@image" },
          connection,
        );
      const image = await sharp({
        create: { width: 12, height: 12, channels: 4, background: "#123456" },
      })
        .png()
        .toBuffer();
      await saveShortcutImage("user", a.id, 1, image, {
        connection,
        assetRoot: root,
      });
      connection.sqlite
        .prepare(
          "UPDATE user_shortcuts SET icon_storage_name=(SELECT icon_storage_name FROM user_shortcuts WHERE id=?),icon_mime_type='image/png' WHERE id=?",
        )
        .run(a.id, b.id);
      await saveShortcutImage("user", a.id, 1, image, {
        connection,
        assetRoot: root,
      });
      expect(
        await readShortcutIcon("user", b.id, 2, {
          connection,
          assetRoot: root,
        }),
      ).not.toBeNull();
    } finally {
      connection.close();
      await rm(root, { recursive: true, force: true });
    }
  });
});
