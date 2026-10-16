import { createReadStream } from "node:fs";
import { lstat } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, unlink, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import sharp from "sharp";
import { z } from "zod";

import { canAccessChatRoom } from "@/lib/chat";
import type { DatabaseConnection } from "@/lib/db/client";
import { getDatabase } from "@/lib/db/client";
import { getServerEnvironment } from "@/lib/env";

import {
  chatFileLimitBytes,
  chatImageLimitBytes,
  isChatImageName,
  validChatFilename,
} from "@/lib/chat-upload";
export const chatAttachmentLimitBytes = chatImageLimitBytes;
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
  if (!/^[a-f0-9-]+\.(?:png|jpg|webp|bin)$/u.test(name))
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
  options: {
    connection?: DatabaseConnection;
    assetRoot?: string;
    filename?: string;
  } = {},
): Promise<number> {
  const actorId = id.parse(userId);
  const targetRoomId = id.parse(roomId);
  const targetMessageId = id.parse(messageId);
  const isFile =
    options.filename !== undefined && !isChatImageName(options.filename);
  if (options.filename !== undefined && !validChatFilename(options.filename))
    throw new Error("Invalid filename.");
  if (
    !data.length ||
    data.length > (isFile ? chatFileLimitBytes : chatImageLimitBytes)
  )
    throw new Error("Invalid attachment.");
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
  const image = isFile
    ? { extension: "bin", mimeType: "application/octet-stream" }
    : await decodeImage(data);
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
    return connection.sqlite.transaction(() => {
      if (
        !canAccessChatRoom(actorId, targetRoomId, connection) ||
        !connection.sqlite
          .prepare(
            "select 1 from chat_messages where id=? and room_id=? and author_user_id=? and deleted_at is null",
          )
          .get(targetMessageId, targetRoomId, actorId)
      )
        throw new Error("Forbidden.");
      const result = Number(
        connection.sqlite
          .prepare(
            `insert into chat_attachments
           (message_id, owner_user_id, storage_name, mime_type, size_bytes, original_name)
           values (?, ?, ?, ?, ?, ?)`,
          )
          .run(
            targetMessageId,
            actorId,
            storageName,
            image.mimeType,
            data.length,
            options.filename ?? null,
          ).lastInsertRowid,
      );
      connection.sqlite
        .prepare(
          "INSERT INTO chat_message_changes(room_id,message_id) VALUES(?,?)",
        )
        .run(targetRoomId, targetMessageId);
      return result;
    })();
  } catch (error) {
    await unlink(path).catch(() => undefined);
    throw error;
  }
}

function attachmentMetadata(
  userId: number,
  attachmentId: number,
  connection: DatabaseConnection,
) {
  const row = connection.sqlite
    .prepare(
      `select a.storage_name as storageName, a.mime_type as mimeType,
              m.room_id as roomId, a.original_name as name
       from chat_attachments a join chat_messages m on m.id = a.message_id
       where a.id = ? and m.deleted_at is null`,
    )
    .get(id.parse(attachmentId)) as
    | {
        storageName: string;
        mimeType: string;
        roomId: number;
        name: string | null;
      }
    | undefined;
  if (!row || !canAccessChatRoom(userId, row.roomId, connection)) return null;
  return row;
}

export async function readChatAttachment(
  userId: number,
  attachmentId: number,
  options: { connection?: DatabaseConnection; assetRoot?: string } = {},
): Promise<{ data: Buffer; mimeType: string; name: string } | null> {
  const row = attachmentMetadata(
    userId,
    attachmentId,
    options.connection ?? getDatabase(),
  );
  if (!row) return null;
  try {
    return {
      data: await readFile(safePath(row.storageName, options.assetRoot)),
      mimeType: row.mimeType,
      name: row.name ?? `imagem.${row.storageName.split(".").at(-1)}`,
    };
  } catch {
    return null;
  }
}

export async function openChatAttachment(
  userId: number,
  attachmentId: number,
  options: { connection?: DatabaseConnection; assetRoot?: string } = {},
) {
  const row = attachmentMetadata(
    userId,
    attachmentId,
    options.connection ?? getDatabase(),
  );
  if (!row) return null;
  const path = safePath(row.storageName, options.assetRoot);
  try {
    const file = await lstat(path);
    if (!file.isFile() || file.isSymbolicLink()) return null;
    return {
      stream: createReadStream(path),
      size: file.size,
      mimeType: row.mimeType,
      name: row.name ?? `imagem.${row.storageName.split(".").at(-1)}`,
    };
  } catch {
    return null;
  }
}
