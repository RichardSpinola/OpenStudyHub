import { getDatabase, type DatabaseConnection } from "@/lib/db/client";
import { canAccessChatRoom } from "@/lib/chat";
import { roomConversation } from "./conversations";
import { enqueueRequest } from "./generation";
import { readAiConfig } from "./config";
export const hasAiMention = (text: string) =>
  /(^|[\s.,!?])@IA(?=$|[\s.,!?])/iu.test(text);
export function enqueueRoomMention(
  userId: number,
  roomId: number,
  messageId: number,
  connection: DatabaseConnection = getDatabase(),
) {
  // Only persisted human messages can trigger the bot. Assistant records live in another table.
  if (!readAiConfig(connection).config.enabled) return null;
  const message = connection.sqlite
    .prepare(
      "SELECT body_source FROM chat_messages WHERE id=? AND room_id=? AND author_user_id=? AND deleted_at IS NULL",
    )
    .get(messageId, roomId, userId) as { body_source: string } | undefined;
  if (!message || !hasAiMention(message.body_source)) return null;
  const conversation = roomConversation(userId, roomId, connection);
  if (!conversation) return null;
  if (
    connection.sqlite
      .prepare("SELECT 1 FROM ai_requests WHERE human_message_id=?")
      .get(messageId)
  )
    return null;
  return enqueueRequest(
    userId,
    conversation,
    message.body_source,
    [],
    connection,
    messageId,
  );
}
export function setRoomAiPermission(
  userId: number,
  roomId: number,
  enabled: boolean,
  connection: DatabaseConnection = getDatabase(),
) {
  if (
    !readAiConfig(connection).config.groups ||
    !canAccessChatRoom(userId, roomId, connection)
  )
    throw new Error("Sem permissão / Not permitted");
  const owner = connection.sqlite
    .prepare(
      "SELECT 1 FROM chat_rooms r JOIN study_group_members m ON m.group_id=r.group_id WHERE r.id=? AND r.kind='group' AND m.user_id=? AND m.member_role='owner'",
    )
    .get(roomId, userId);
  if (!owner)
    throw new Error(
      "Somente o responsável pelo grupo pode autorizar @IA. / Only the group owner can authorize @IA.",
    );
  connection.sqlite
    .prepare(
      "INSERT INTO ai_room_permissions(room_id,enabled) VALUES(?,?) ON CONFLICT(room_id) DO UPDATE SET enabled=excluded.enabled",
    )
    .run(roomId, enabled ? 1 : 0);
  if (!enabled)
    connection.sqlite
      .prepare(
        "UPDATE ai_requests SET cancel_requested=1 WHERE conversation_id IN (SELECT id FROM ai_conversations WHERE room_id=?) AND status IN ('queued','running')",
      )
      .run(roomId);
}
