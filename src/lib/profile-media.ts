import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, unlink, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import sharp from "sharp";
import { z } from "zod";

import type { DatabaseConnection } from "@/lib/db/client";
import { getDatabase } from "@/lib/db/client";
import { getServerEnvironment } from "@/lib/env";

export const profileMediaLimitBytes = 5 * 1024 * 1024;
export type ProfileMediaKind = "avatar" | "banner";
type ImageKind = { extension: "png" | "jpg" | "webp"; mimeType: string };

function column(kind: ProfileMediaKind) {
  return kind === "avatar"
    ? { storage: "avatar_storage_name", mime: "avatar_mime_type" }
    : { storage: "banner_storage_name", mime: "banner_mime_type" };
}

async function detect(data: Buffer): Promise<ImageKind | null> {
  try {
    const metadata = await sharp(data, {
      failOn: "warning",
      limitInputPixels: 20_000_000,
    }).metadata();
    if (!metadata.width || !metadata.height) return null;
    if (metadata.format === "png")
      return { extension: "png", mimeType: "image/png" };
    if (metadata.format === "jpeg")
      return { extension: "jpg", mimeType: "image/jpeg" };
    if (metadata.format === "webp")
      return { extension: "webp", mimeType: "image/webp" };
    return null;
  } catch {
    return null;
  }
}

function safePath(storageName: string, rootInput?: string): string {
  if (!/^[a-f0-9-]+\.(?:png|jpg|webp)$/u.test(storageName)) {
    throw new Error("Invalid private asset reference.");
  }
  const root = resolve(
    rootInput ?? getServerEnvironment().PRIVATE_ASSET_PATH,
    "profiles",
  );
  const path = resolve(root, storageName);
  if (!path.startsWith(`${root}/`))
    throw new Error("Invalid private asset path.");
  return path;
}

export async function saveProfileMedia(
  userId: number,
  kind: ProfileMediaKind,
  data: Buffer,
  options: { connection?: DatabaseConnection; assetRoot?: string } = {},
): Promise<void> {
  const ownerId = z.number().int().positive().parse(userId);
  if (!data.length || data.length > profileMediaLimitBytes)
    throw new Error("Invalid image size.");
  const image = await detect(data);
  if (!image) throw new Error("Invalid image format.");
  const connection = options.connection ?? getDatabase();
  const fields = column(kind);
  const previous = connection.sqlite
    .prepare(
      `select ${fields.storage} as storageName from users where id = ? and active = 1`,
    )
    .get(ownerId) as { storageName: string | null } | undefined;
  if (!previous) throw new Error("Profile not found.");
  const storageName = `${randomUUID()}.${image.extension}`;
  const finalPath = safePath(storageName, options.assetRoot);
  await mkdir(resolve(finalPath, ".."), { recursive: true, mode: 0o700 });
  await writeFile(`${finalPath}.tmp`, data, { flag: "wx", mode: 0o600 });
  await rename(`${finalPath}.tmp`, finalPath);
  try {
    connection.sqlite
      .prepare(
        `update users set ${fields.storage} = ?, ${fields.mime} = ?, updated_at = ? where id = ?`,
      )
      .run(storageName, image.mimeType, Date.now(), ownerId);
  } catch (error) {
    await unlink(finalPath).catch(() => undefined);
    throw error;
  }
  if (previous.storageName)
    await unlink(safePath(previous.storageName, options.assetRoot)).catch(
      () => undefined,
    );
}

export async function readProfileMedia(
  userId: number,
  kind: ProfileMediaKind,
  options: { connection?: DatabaseConnection; assetRoot?: string } = {},
): Promise<{ data: Buffer; mimeType: string } | null> {
  const fields = column(kind);
  const row = (options.connection ?? getDatabase()).sqlite
    .prepare(
      `select ${fields.storage} as storageName, ${fields.mime} as mimeType from users where id = ? and active = 1`,
    )
    .get(z.number().int().positive().parse(userId)) as
    { storageName: string | null; mimeType: string | null } | undefined;
  if (!row?.storageName || !row.mimeType) return null;
  try {
    return {
      data: await readFile(safePath(row.storageName, options.assetRoot)),
      mimeType: row.mimeType,
    };
  } catch {
    return null;
  }
}

export async function removeProfileMedia(
  userId: number,
  kind: ProfileMediaKind,
  options: { connection?: DatabaseConnection; assetRoot?: string } = {},
): Promise<void> {
  const connection = options.connection ?? getDatabase();
  const fields = column(kind);
  const row = connection.sqlite
    .prepare(`select ${fields.storage} as storageName from users where id = ?`)
    .get(userId) as { storageName: string | null } | undefined;
  connection.sqlite
    .prepare(
      `update users set ${fields.storage} = null, ${fields.mime} = null, updated_at = ? where id = ?`,
    )
    .run(Date.now(), userId);
  if (row?.storageName)
    await unlink(safePath(row.storageName, options.assetRoot)).catch(
      () => undefined,
    );
}
