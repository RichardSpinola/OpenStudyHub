import { randomUUID } from "node:crypto";
import { z } from "zod";
import {
  canAccessChatRoom,
  listChatRooms,
  sendChatMessage,
  type ChatRoom,
} from "@/lib/chat";
import { getDatabase, type DatabaseConnection } from "@/lib/db/client";
import { withV2Db } from "./runtime-database";
import type { V2Database } from "./database";

const id = z.number().int().positive();
const globalKey = "chat.global_room_id";

export function canonicalChatUserId(
  db: V2Database,
  legacyUserId: number,
): number {
  const row = db
    .prepare("SELECT user_id id FROM legacy_user_links WHERE legacy_user_id=?")
    .get(id.parse(legacyUserId)) as { id: number } | undefined;
  if (!row) throw new Error("Identidade normal V2 necessária.");
  return row.id;
}

export function legacyChatUserId(
  db: V2Database,
  canonicalUserId: number,
): number {
  const row = db
    .prepare("SELECT legacy_user_id id FROM legacy_user_links WHERE user_id=?")
    .get(id.parse(canonicalUserId)) as { id: number } | undefined;
  if (!row) throw new Error("Vínculo legado necessário.");
  return row.id;
}

export function ensureGlobalChatRoom(
  connection: DatabaseConnection = getDatabase(),
): number {
  return connection.sqlite
    .transaction(() => {
      const saved = connection.sqlite
        .prepare("SELECT value FROM app_settings WHERE key=?")
        .get(globalKey) as { value: string } | undefined;
      if (saved) {
        const roomId = Number(saved.value);
        if (
          Number.isInteger(roomId) &&
          roomId > 0 &&
          connection.sqlite
            .prepare(
              "SELECT 1 FROM chat_rooms WHERE id=? AND archived_at IS NULL",
            )
            .get(roomId)
        )
          return roomId;
      }
      const creator = connection.sqlite
        .prepare(
          "SELECT id FROM users WHERE active=1 AND role='member' ORDER BY id LIMIT 1",
        )
        .get() as { id: number } | undefined;
      if (!creator) throw new Error("Nenhum usuário normal disponível.");
      const roomId = Number(
        connection.sqlite
          .prepare(
            "INSERT INTO chat_rooms(kind,name,created_by_user_id,created_at) VALUES('audience','Global',?,?)",
          )
          .run(creator.id, Date.now()).lastInsertRowid,
      );
      connection.sqlite
        .prepare(
          "INSERT INTO chat_room_audiences(room_id,audience_type) VALUES(?,'instance')",
        )
        .run(roomId);
      connection.sqlite
        .prepare(
          `INSERT INTO app_settings(key,value,updated_at) VALUES(?,?,?)
       ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=excluded.updated_at`,
        )
        .run(globalKey, String(roomId), Date.now());
      return roomId;
    })
    .immediate();
}

export type RoomSummary = ChatRoom & {
  avatarVersion: number | null;
  lastMessagePreview: string | null;
  unreadCount: number;
  archived: boolean;
  closed: boolean;
  peer: { id: number; name: string; hasAvatar: boolean } | null;
};

export function listChatRoomSummaries(legacyUserId: number): RoomSummary[] {
  const connection = getDatabase();
  ensureGlobalChatRoom(connection);
  const rooms = listChatRooms(legacyUserId, connection);
  return withV2Db((db) => {
    const userId = canonicalChatUserId(db, legacyUserId);
    const state = db.prepare(
      "SELECT archived_at archivedAt,closed_at closedAt,last_read_message_id lastRead FROM user_chat_room_state WHERE user_id=? AND room_id=?",
    );
    const latest = connection.sqlite.prepare(
      "SELECT id,body_source body,created_at createdAt FROM chat_messages WHERE room_id=? AND deleted_at IS NULL ORDER BY id DESC LIMIT 1",
    );
    const unread = connection.sqlite.prepare(
      "SELECT count(*) count FROM chat_messages WHERE room_id=? AND id>? AND author_user_id<>? AND deleted_at IS NULL",
    );
    const peer = connection.sqlite.prepare(
      `SELECT u.id,u.display_name name,CASE WHEN u.avatar_storage_name IS NULL THEN 0 ELSE 1 END hasAvatar
       FROM chat_direct_members m JOIN users u ON u.id=m.user_id
       WHERE m.room_id=? AND m.user_id<>? LIMIT 1`,
    );
    const roomAvatar = db.prepare(
      "SELECT version FROM chat_room_avatars WHERE legacy_room_id=?",
    );
    return rooms.map((room) => {
      const personal = state.get(userId, room.id) as
        | {
            archivedAt: number | null;
            closedAt: number | null;
            lastRead: number;
          }
        | undefined;
      const message = latest.get(room.id) as
        { id: number; body: string; createdAt: number } | undefined;
      return {
        ...room,
        avatarVersion:
          room.kind === "direct"
            ? null
            : ((roomAvatar.get(room.id) as { version: number } | undefined)
                ?.version ?? null),
        lastMessageAt: message?.createdAt ?? room.lastMessageAt,
        lastMessagePreview:
          message?.body.slice(0, 90) || (message ? "Imagem" : null),
        unreadCount: (
          unread.get(room.id, personal?.lastRead ?? 0, legacyUserId) as {
            count: number;
          }
        ).count,
        archived: Boolean(personal?.archivedAt),
        closed: Boolean(personal?.closedAt),
        peer:
          room.kind === "direct"
            ? (() => {
                const value = peer.get(room.id, legacyUserId) as
                  { id: number; name: string; hasAvatar: number } | undefined;
                return value
                  ? { ...value, hasAvatar: Boolean(value.hasAvatar) }
                  : null;
              })()
            : null,
      };
    });
  });
}

export function changePersonalRoomState(
  legacyUserId: number,
  roomId: number,
  action: "archive" | "restore" | "close" | "read",
): void {
  if (!canAccessChatRoom(legacyUserId, id.parse(roomId)))
    throw new Error("Sem acesso à conversa.");
  const connection = getDatabase();
  const last = (
    connection.sqlite
      .prepare(
        "SELECT coalesce(max(id),0) id FROM chat_messages WHERE room_id=?",
      )
      .get(roomId) as { id: number }
  ).id;
  withV2Db((db) => {
    const userId = canonicalChatUserId(db, legacyUserId);
    db.prepare(
      "INSERT OR IGNORE INTO user_chat_room_state(user_id,room_id) VALUES(?,?)",
    ).run(userId, roomId);
    if (action === "read")
      db.prepare(
        "UPDATE user_chat_room_state SET last_read_message_id=max(last_read_message_id,?) WHERE user_id=? AND room_id=?",
      ).run(last, userId, roomId);
    if (action === "archive")
      db.prepare(
        "UPDATE user_chat_room_state SET archived_at=?,closed_at=NULL WHERE user_id=? AND room_id=?",
      ).run(Date.now(), userId, roomId);
    if (action === "close")
      db.prepare(
        "UPDATE user_chat_room_state SET closed_at=?,archived_at=NULL WHERE user_id=? AND room_id=?",
      ).run(Date.now(), userId, roomId);
    if (action === "restore")
      db.prepare(
        "UPDATE user_chat_room_state SET archived_at=NULL,closed_at=NULL WHERE user_id=? AND room_id=?",
      ).run(userId, roomId);
  });
}

export function chatWallpaper(legacyUserId: number): {
  preset: "plain" | "grid" | "dots" | "custom";
  updatedAt: number;
} {
  return withV2Db((db) => {
    const userId = canonicalChatUserId(db, legacyUserId);
    const row = db
      .prepare(
        "SELECT preset,image IS NOT NULL hasImage,updated_at updatedAt FROM user_chat_wallpaper WHERE user_id=?",
      )
      .get(userId) as
      | {
          preset: "plain" | "grid" | "dots";
          hasImage: number;
          updatedAt: number;
        }
      | undefined;
    return {
      preset: row?.hasImage ? "custom" : (row?.preset ?? "plain"),
      updatedAt: row?.updatedAt ?? 0,
    };
  });
}

export function saveChatWallpaper(legacyUserId: number, preset: unknown): void {
  const value = z.enum(["plain", "grid", "dots"]).parse(preset);
  withV2Db((db) => {
    const userId = canonicalChatUserId(db, legacyUserId);
    db.prepare(
      "INSERT INTO user_chat_wallpaper(user_id,preset,image,mime_type,updated_at) VALUES(?,?,NULL,NULL,?) ON CONFLICT(user_id) DO UPDATE SET preset=excluded.preset,image=NULL,mime_type=NULL,updated_at=excluded.updated_at",
    ).run(userId, value, Date.now());
  });
}

export function saveChatWallpaperImage(
  legacyUserId: number,
  image: Buffer,
  mimeType: string,
): void {
  if (
    !image.length ||
    image.length > 10 * 1024 * 1024 ||
    !["image/png", "image/jpeg", "image/webp"].includes(mimeType)
  )
    throw new Error("Imagem inválida.");
  withV2Db((db) => {
    const userId = canonicalChatUserId(db, legacyUserId);
    db.prepare(
      "INSERT INTO user_chat_wallpaper(user_id,preset,image,mime_type,updated_at) VALUES(?,'plain',?,?,?) ON CONFLICT(user_id) DO UPDATE SET image=excluded.image,mime_type=excluded.mime_type,updated_at=excluded.updated_at",
    ).run(userId, image, mimeType, Date.now());
  });
}

export function readChatWallpaperImage(
  legacyUserId: number,
): { image: Buffer; mimeType: string } | null {
  return withV2Db((db) => {
    const userId = canonicalChatUserId(db, legacyUserId);
    return (
      (db
        .prepare(
          "SELECT image,mime_type mimeType FROM user_chat_wallpaper WHERE user_id=? AND image IS NOT NULL",
        )
        .get(userId) as { image: Buffer; mimeType: string } | undefined) ?? null
    );
  });
}

export function sendChatMessageOnce(
  canonicalUserId: number,
  legacyUserId: number,
  roomId: number,
  clientMessageId: string,
  body: string,
  replyToMessageId: number | null,
  hasAttachment = false,
) {
  const key = z.string().uuid().parse(clientMessageId);
  return withV2Db((db) =>
    db
      .transaction(() => {
        const previous = db
          .prepare(
            "SELECT room_id roomId,message_id messageId FROM chat_send_keys WHERE user_id=? AND client_message_id=?",
          )
          .get(canonicalUserId, key) as
          { roomId: number; messageId: number } | undefined;
        if (previous) {
          if (
            previous.roomId !== roomId ||
            !canAccessChatRoom(legacyUserId, roomId)
          )
            throw new Error("Mensagem indisponível.");
          return { messageId: previous.messageId, duplicate: true };
        }
        const message = sendChatMessage(legacyUserId, roomId, {
          body,
          replyToMessageId,
          hasAttachment,
        });
        db.prepare(
          "INSERT INTO chat_send_keys(user_id,client_message_id,room_id,message_id,created_at) VALUES(?,?,?,?,?)",
        ).run(canonicalUserId, key, roomId, message.id, Date.now());
        return { messageId: message.id, duplicate: false };
      })
      .immediate(),
  );
}

export function newClientMessageId(): string {
  return randomUUID();
}
