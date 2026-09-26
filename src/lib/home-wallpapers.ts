import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, unlink, writeFile } from "node:fs/promises";

import type { V2Database } from "@/lib/v2/database";
import { withV2Db, withV2DbAsync } from "@/lib/v2/runtime";
import { getServerEnvironment } from "@/lib/env";
import { detectHomeImage, safeHomeAssetPath } from "@/lib/home-background";

export const v2WallpaperLimitBytes = 10 * 1024 * 1024;

export const wallpaperPresets = ["none", "grid", "horizon", "paper"] as const;
export type WallpaperPreset = (typeof wallpaperPresets)[number];

type WallpaperRow = {
  id: number;
  storageName: string;
  mimeType: "image/png" | "image/jpeg" | "image/webp";
  sizeBytes: number;
  createdAt: number;
};
export type WallpaperCatalog = {
  selected: string;
  wallpapers: Array<Pick<WallpaperRow, "id" | "createdAt">>;
};

function canonicalId(db: V2Database, legacyUserId: number): number {
  const row = db
    .prepare("SELECT user_id id FROM legacy_user_links WHERE legacy_user_id=?")
    .get(legacyUserId) as { id: number } | undefined;
  if (!row) throw new Error("Identidade V2 não vinculada.");
  return row.id;
}

function wallpaperRows(db: V2Database, userId: number): WallpaperRow[] {
  return db
    .prepare(
      `SELECT id,storage_name storageName,mime_type mimeType,size_bytes sizeBytes,created_at createdAt
       FROM user_home_wallpapers WHERE user_id=? ORDER BY created_at DESC,id DESC`,
    )
    .all(userId) as WallpaperRow[];
}

export function getWallpaperCatalog(
  legacyUserId: number,
  legacyConfigured = false,
): WallpaperCatalog {
  if (process.env.OPENSTUDYHUB_V2_ENABLED !== "1")
    return { selected: legacyConfigured ? "legacy" : "none", wallpapers: [] };
  return withV2Db((db) => {
    const id = canonicalId(db, legacyUserId);
    const choice = db
      .prepare(
        "SELECT preset,selected_wallpaper_id wallpaperId FROM user_home_background_choice WHERE user_id=?",
      )
      .get(id) as
      { preset: WallpaperPreset; wallpaperId: number | null } | undefined;
    const rows = wallpaperRows(db, id);
    const selected = choice
      ? choice.wallpaperId && rows.some((row) => row.id === choice.wallpaperId)
        ? `custom:${choice.wallpaperId}`
        : choice.preset
      : legacyConfigured
        ? "legacy"
        : "none";
    return {
      selected,
      wallpapers: rows.map(({ id: wallpaperId, createdAt }) => ({
        id: wallpaperId,
        createdAt,
      })),
    };
  });
}

function upsertChoice(
  db: V2Database,
  userId: number,
  preset: WallpaperPreset,
  wallpaperId: number | null,
): void {
  db.prepare(
    `INSERT INTO user_home_background_choice(user_id,preset,selected_wallpaper_id,updated_at)
     VALUES(?,?,?,?) ON CONFLICT(user_id) DO UPDATE SET
     preset=excluded.preset,selected_wallpaper_id=excluded.selected_wallpaper_id,
     updated_at=excluded.updated_at`,
  ).run(userId, preset, wallpaperId, Date.now());
}

export function chooseWallpaper(
  legacyUserId: number,
  choice: WallpaperPreset | number,
): void {
  withV2Db((db) => {
    const id = canonicalId(db, legacyUserId);
    if (typeof choice === "number") {
      if (!Number.isSafeInteger(choice) || choice < 1)
        throw new Error("Wallpaper inválido.");
      const owned = db
        .prepare("SELECT 1 FROM user_home_wallpapers WHERE user_id=? AND id=?")
        .get(id, choice);
      if (!owned) throw new Error("Wallpaper indisponível.");
      const old = db
        .prepare(
          "SELECT preset FROM user_home_background_choice WHERE user_id=?",
        )
        .get(id) as { preset: WallpaperPreset } | undefined;
      upsertChoice(db, id, old?.preset ?? "none", choice);
    } else {
      if (!wallpaperPresets.includes(choice))
        throw new Error("Wallpaper padrão inválido.");
      upsertChoice(db, id, choice, null);
    }
  });
}

export async function uploadWallpaper(
  legacyUserId: number,
  data: Buffer,
): Promise<void> {
  if (!data.length || data.length > v2WallpaperLimitBytes)
    throw new Error("Imagem acima do limite.");
  const image = await detectHomeImage(data);
  if (!image) throw new Error("Formato de imagem inválido.");
  const root = getServerEnvironment().PRIVATE_ASSET_PATH;
  await mkdir(root, { recursive: true, mode: 0o700 });
  const storageName = `${randomUUID()}.${image.extension}`;
  const finalPath = safeHomeAssetPath(storageName, root);
  const temporaryPath = `${finalPath}.tmp`;
  await writeFile(temporaryPath, data, { flag: "wx", mode: 0o600 });
  await rename(temporaryPath, finalPath);
  let expired: WallpaperRow[] = [];
  try {
    await withV2DbAsync(async (db) => {
      const id = canonicalId(db, legacyUserId);
      expired = db.transaction(() => {
        const result = db
          .prepare(
            `INSERT INTO user_home_wallpapers(user_id,storage_name,mime_type,size_bytes,created_at)
             VALUES(?,?,?,?,?)`,
          )
          .run(id, storageName, image.mimeType, data.length, Date.now());
        const rows = wallpaperRows(db, id);
        const old = rows.slice(3);
        upsertChoice(db, id, "none", Number(result.lastInsertRowid));
        for (const row of old)
          db.prepare(
            "DELETE FROM user_home_wallpapers WHERE user_id=? AND id=?",
          ).run(id, row.id);
        return old;
      })();
    });
  } catch (error) {
    await unlink(finalPath).catch(() => undefined);
    throw error;
  }
  for (const row of expired)
    await unlink(safeHomeAssetPath(row.storageName, root)).catch(
      () => undefined,
    );
}

export async function removeWallpaper(
  legacyUserId: number,
  wallpaperId: number,
): Promise<void> {
  if (!Number.isSafeInteger(wallpaperId) || wallpaperId < 1)
    throw new Error("Wallpaper inválido.");
  const row = withV2Db((db) => {
    const id = canonicalId(db, legacyUserId);
    return db.transaction(() => {
      const owned = db
        .prepare(
          "SELECT id,storage_name storageName,mime_type mimeType,size_bytes sizeBytes,created_at createdAt FROM user_home_wallpapers WHERE user_id=? AND id=?",
        )
        .get(id, wallpaperId) as WallpaperRow | undefined;
      if (!owned) throw new Error("Wallpaper indisponível.");
      db.prepare(
        "DELETE FROM user_home_wallpapers WHERE user_id=? AND id=?",
      ).run(id, wallpaperId);
      return owned;
    })();
  });
  await unlink(
    safeHomeAssetPath(
      row.storageName,
      getServerEnvironment().PRIVATE_ASSET_PATH,
    ),
  ).catch(() => undefined);
}

export async function readWallpaper(
  legacyUserId: number,
  wallpaperId: number,
): Promise<{ data: Buffer; mimeType: string } | null> {
  const row = withV2Db((db) => {
    const id = canonicalId(db, legacyUserId);
    return db
      .prepare(
        "SELECT id,storage_name storageName,mime_type mimeType,size_bytes sizeBytes,created_at createdAt FROM user_home_wallpapers WHERE user_id=? AND id=?",
      )
      .get(id, wallpaperId) as WallpaperRow | undefined;
  });
  if (!row) return null;
  try {
    return {
      data: await readFile(
        safeHomeAssetPath(
          row.storageName,
          getServerEnvironment().PRIVATE_ASSET_PATH,
        ),
      ),
      mimeType: row.mimeType,
    };
  } catch {
    return null;
  }
}
