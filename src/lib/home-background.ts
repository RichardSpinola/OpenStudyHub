import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, unlink, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import sharp from "sharp";

import type { DatabaseConnection } from "@/lib/db/client";
import { getDatabase } from "@/lib/db/client";
import { getServerEnvironment } from "@/lib/env";

export const homeBackgroundLimitBytes = 10 * 1024 * 1024;

export type SupportedImage = {
  extension: "png" | "jpg" | "webp";
  mimeType: "image/png" | "image/jpeg" | "image/webp";
};

export type HomeBackgroundRecord = {
  storageName: string;
  mimeType: SupportedImage["mimeType"];
  sizeBytes: number;
  updatedAt: number;
};

export async function detectHomeImage(
  data: Buffer,
): Promise<SupportedImage | null> {
  try {
    const metadata = await sharp(data, {
      failOn: "warning",
      limitInputPixels: 16_000_000,
    }).metadata();
    if (!metadata.width || !metadata.height) return null;
    if (metadata.format === "png") {
      return { extension: "png", mimeType: "image/png" };
    }
    if (metadata.format === "jpeg") {
      return { extension: "jpg", mimeType: "image/jpeg" };
    }
    if (metadata.format === "webp") {
      return { extension: "webp", mimeType: "image/webp" };
    }
    return null;
  } catch {
    return null;
  }
}

export function safeHomeAssetPath(storageName: string, root: string): string {
  if (!/^[a-f0-9-]+\.(?:png|jpg|webp)$/u.test(storageName)) {
    throw new Error("Invalid private asset reference.");
  }
  const assetRoot = resolve(root);
  const path = resolve(assetRoot, storageName);
  if (!path.startsWith(`${assetRoot}/`)) {
    throw new Error("Invalid private asset path.");
  }
  return path;
}

function configuredRoot(root?: string): string {
  return root ?? getServerEnvironment().PRIVATE_ASSET_PATH;
}

export function getHomeBackground(
  userId: number,
  connection: DatabaseConnection = getDatabase(),
): HomeBackgroundRecord | null {
  return (
    (connection.sqlite
      .prepare(
        `select storage_name as storageName, mime_type as mimeType,
                size_bytes as sizeBytes, updated_at as updatedAt
         from user_home_assets
         where owner_user_id = ? and kind = 'background'`,
      )
      .get(userId) as HomeBackgroundRecord | undefined) ?? null
  );
}

export async function saveHomeBackground(
  userId: number,
  data: Buffer,
  options: { connection?: DatabaseConnection; assetRoot?: string } = {},
): Promise<HomeBackgroundRecord> {
  if (data.length === 0 || data.length > homeBackgroundLimitBytes) {
    throw new Error("Home background size is invalid.");
  }
  const image = await detectHomeImage(data);
  if (!image) throw new Error("Home background format is invalid.");
  const connection = options.connection ?? getDatabase();
  const root = configuredRoot(options.assetRoot);
  await mkdir(root, { recursive: true, mode: 0o700 });
  const storageName = `${randomUUID()}.${image.extension}`;
  const finalPath = safeHomeAssetPath(storageName, root);
  const temporaryPath = `${finalPath}.tmp`;
  await writeFile(temporaryPath, data, { flag: "wx", mode: 0o600 });
  await rename(temporaryPath, finalPath);
  const previous = getHomeBackground(userId, connection);
  const now = Date.now();
  try {
    connection.sqlite
      .prepare(
        `insert into user_home_assets
         (owner_user_id, kind, storage_name, mime_type, size_bytes,
          created_at, updated_at)
         values (?, 'background', ?, ?, ?, ?, ?)
         on conflict(owner_user_id, kind) do update set
           storage_name = excluded.storage_name,
           mime_type = excluded.mime_type,
           size_bytes = excluded.size_bytes,
           updated_at = excluded.updated_at`,
      )
      .run(userId, storageName, image.mimeType, data.length, now, now);
  } catch (error) {
    await unlink(finalPath).catch(() => undefined);
    throw error;
  }
  if (previous) {
    await unlink(safeHomeAssetPath(previous.storageName, root)).catch(
      () => undefined,
    );
  }
  return getHomeBackground(userId, connection)!;
}

export async function readHomeBackground(
  userId: number,
  options: { connection?: DatabaseConnection; assetRoot?: string } = {},
): Promise<{ data: Buffer; record: HomeBackgroundRecord } | null> {
  const connection = options.connection ?? getDatabase();
  const record = getHomeBackground(userId, connection);
  if (!record) return null;
  try {
    return {
      data: await readFile(
        safeHomeAssetPath(
          record.storageName,
          configuredRoot(options.assetRoot),
        ),
      ),
      record,
    };
  } catch {
    return null;
  }
}

export async function removeHomeBackground(
  userId: number,
  options: { connection?: DatabaseConnection; assetRoot?: string } = {},
): Promise<void> {
  const connection = options.connection ?? getDatabase();
  const record = getHomeBackground(userId, connection);
  connection.sqlite
    .prepare(
      "delete from user_home_assets where owner_user_id = ? and kind = 'background'",
    )
    .run(userId);
  if (record) {
    await unlink(
      safeHomeAssetPath(record.storageName, configuredRoot(options.assetRoot)),
    ).catch(() => undefined);
  }
}
