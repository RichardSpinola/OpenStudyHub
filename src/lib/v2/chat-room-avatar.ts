import { canAccessChatRoom } from "@/lib/chat";
import { getDatabase, type DatabaseConnection } from "@/lib/db/client";
import { withV2Db } from "./runtime-database";

export const chatRoomAvatarLimitBytes = 5 * 1024 * 1024;

export function canManageChatRoomAvatar(
  legacyUserId: number,
  roomId: number,
  connection: DatabaseConnection = getDatabase(),
): boolean {
  if (!canAccessChatRoom(legacyUserId, roomId, connection)) return false;
  const room = connection.sqlite
    .prepare(
      `SELECT r.kind, r.created_by_user_id creatorId, m.member_role memberRole
       FROM chat_rooms r LEFT JOIN study_group_members m
         ON m.group_id=r.group_id AND m.user_id=? WHERE r.id=?`,
    )
    .get(legacyUserId, roomId) as
    { kind: string; creatorId: number; memberRole: string | null } | undefined;
  return Boolean(
    room &&
    room.kind !== "direct" &&
    (room.creatorId === legacyUserId || room.memberRole === "owner"),
  );
}

export function saveChatRoomAvatar(
  legacyUserId: number,
  roomId: number,
  image: Buffer,
  mimeType: string,
  connection: DatabaseConnection = getDatabase(),
): void {
  if (!canManageChatRoomAvatar(legacyUserId, roomId, connection))
    throw new Error("Sem permissão para alterar a imagem da conversa.");
  if (!image.length || image.length > chatRoomAvatarLimitBytes)
    throw new Error("Tamanho de imagem inválido.");
  if (!["image/png", "image/jpeg", "image/webp"].includes(mimeType))
    throw new Error("Formato de imagem inválido.");
  withV2Db((db) =>
    db
      .prepare(
        `INSERT INTO chat_room_avatars(legacy_room_id,image,mime_type,version)
       VALUES(?,?,?,?) ON CONFLICT(legacy_room_id) DO UPDATE SET
       image=excluded.image,mime_type=excluded.mime_type,version=excluded.version`,
      )
      .run(roomId, image, mimeType, Date.now()),
  );
}

export function readChatRoomAvatar(
  legacyUserId: number,
  roomId: number,
  connection: DatabaseConnection = getDatabase(),
): { image: Buffer; mimeType: string } | null {
  if (!canAccessChatRoom(legacyUserId, roomId, connection)) return null;
  const kind = connection.sqlite
    .prepare("SELECT kind FROM chat_rooms WHERE id=?")
    .get(roomId) as { kind: string } | undefined;
  if (!kind || kind.kind === "direct") return null;
  return withV2Db(
    (db) =>
      (db
        .prepare(
          "SELECT image,mime_type mimeType FROM chat_room_avatars WHERE legacy_room_id=?",
        )
        .get(roomId) as { image: Buffer; mimeType: string } | undefined) ??
      null,
  );
}
