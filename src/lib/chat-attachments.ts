import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, unlink, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import sharp from "sharp";
import { z } from "zod";

import { canAccessChatRoom } from "@/lib/chat";
import type { DatabaseConnection } from "@/lib/db/client";
import { getDatabase } from "@/lib/db/client";
import { getServerEnvironment } from "@/lib/env";

export const chatAttachmentLimitBytes = 5 * 1024 * 1024;
const id = z.number().int().positive();

async function decodeImage(data: Buffer) {
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

export async function isValidChatAttachmentData(
  data: Buffer,
): Promise<boolean> {
  if (!data.length || data.length > chatAttachmentLimitBytes) return false;
  return (await decodeImage(data)) !== null;
}

function rootPath(root?: string) {
  return resolve(root ?? getServerEnvironment().PRIVATE_ASSET_PATH, "chat");
}

function safePath(name: string, root?: string) {
  if (!/^[a-f0-9-]+\.(?:png|jpg|webp)$/u.test(name))
    throw new Error("Invalid attachment.");
  const base = rootPath(root);
  const path = resolve(base, name);
  if (!path.startsWith(`${base}/`)) throw new Error("Invalid attachment.");
  return path;
}

export async function saveChatAttachment(
  userId: number,
  roomId: number,
  messageId: number,
  data: Buffer,
  options: { connection?: DatabaseConnection; assetRoot?: string } = {},
): Promise<number> {
  const actorId = id.parse(userId);
  const targetRoomId = id.parse(roomId);
  const targetMessageId = id.parse(messageId);
  if (!data.length || data.length > chatAttachmentLimitBytes)
    throw new Error("Invalid image.");
  const connection = options.connection ?? getDatabase();
  if (!canAccessChatRoom(actorId, targetRoomId, connection))
    throw new Error("Forbidden.");
  if (
    !connection.sqlite
      .prepare(
        "select 1 from chat_messages where id = ? and room_id = ? and author_user_id = ? and deleted_at is null",
      )
      .get(targetMessageId, targetRoomId, actorId)
  )
    throw new Error("Message not found.");
  const image = await decodeImage(data);
  if (!image) throw new Error("Invalid image.");
  if (
    connection.sqlite
      .prepare("select 1 from chat_attachments where message_id = ?")
      .get(targetMessageId)
  ) {
    throw new Error("Message already has an attachment.");
  }
  const storageName = `${randomUUID()}.${image.extension}`;
  const path = safePath(storageName, options.assetRoot);
  await mkdir(rootPath(options.assetRoot), { recursive: true, mode: 0o700 });
  await writeFile(`${path}.tmp`, data, { flag: "wx", mode: 0o600 });
  await rename(`${path}.tmp`, path);
  try {
    return Number(
      connection.sqlite
        .prepare(
          `insert into chat_attachments
           (message_id, owner_user_id, storage_name, mime_type, size_bytes)
           values (?, ?, ?, ?, ?)`,
        )
        .run(targetMessageId, actorId, storageName, image.mimeType, data.length)
        .lastInsertRowid,
    );
  } catch (error) {
    await unlink(path).catch(() => undefined);
    throw error;
  }
}

export async function readChatAttachment(
  userId: number,
  attachmentId: number,
  options: { connection?: DatabaseConnection; assetRoot?: string } = {},
): Promise<{ data: Buffer; mimeType: string } | null> {
  const connection = options.connection ?? getDatabase();
  const row = connection.sqlite
    .prepare(
      `select a.storage_name as storageName, a.mime_type as mimeType,
              m.room_id as roomId
       from chat_attachments a join chat_messages m on m.id = a.message_id
       where a.id = ? and m.deleted_at is null`,
    )
    .get(id.parse(attachmentId)) as
    { storageName: string; mimeType: string; roomId: number } | undefined;
  if (!row || !canAccessChatRoom(userId, row.roomId, connection)) return null;
  try {
    return {
      data: await readFile(safePath(row.storageName, options.assetRoot)),
      mimeType: row.mimeType,
    };
  } catch {
    return null;
  }
}
