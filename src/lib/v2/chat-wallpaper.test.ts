import { afterEach, expect, it } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openV2Database, migrateV2 } from "./database";
import {
  chatWallpaper,
  readChatWallpaperImage,
  saveChatWallpaper,
  saveChatWallpaperImage,
} from "./chat-state";

const oldEnabled = process.env.OPENSTUDYHUB_V2_ENABLED;
const oldPath = process.env.OPENSTUDYHUB_V2_DATABASE_PATH;
const roots: string[] = [];
afterEach(() => {
  if (oldEnabled === undefined) delete process.env.OPENSTUDYHUB_V2_ENABLED;
  else process.env.OPENSTUDYHUB_V2_ENABLED = oldEnabled;
  if (oldPath === undefined) delete process.env.OPENSTUDYHUB_V2_DATABASE_PATH;
  else process.env.OPENSTUDYHUB_V2_DATABASE_PATH = oldPath;
  for (const root of roots.splice(0))
    rmSync(root, { recursive: true, force: true });
});

it("keeps a Chat image private per user and removes it when a preset is selected", () => {
  const root = mkdtempSync(join(tmpdir(), "osh-chat-wallpaper-"));
  roots.push(root);
  const path = join(root, "v2.db");
  const db = openV2Database(path);
  migrateV2(db);
  db.exec(
    "INSERT INTO users(id,login,display_name,password_hash) VALUES(1,'a','A','hash'),(2,'b','B','hash'); INSERT INTO legacy_user_links(user_id,legacy_user_id,linked_at) VALUES(1,41,1),(2,42,1)",
  );
  db.close();
  process.env.OPENSTUDYHUB_V2_ENABLED = "1";
  process.env.OPENSTUDYHUB_V2_DATABASE_PATH = path;
  const image = Buffer.from("fake-image-bytes");
  saveChatWallpaperImage(41, image, "image/png");
  expect(chatWallpaper(41).preset).toBe("custom");
  expect(readChatWallpaperImage(41)?.image).toEqual(image);
  expect(readChatWallpaperImage(42)).toBeNull();
  expect(() =>
    saveChatWallpaperImage(41, Buffer.alloc(10 * 1024 * 1024 + 1), "image/png"),
  ).toThrow();
  saveChatWallpaper(41, "dots");
  expect(chatWallpaper(41).preset).toBe("dots");
  expect(readChatWallpaperImage(41)).toBeNull();
});
