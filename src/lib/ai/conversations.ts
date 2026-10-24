import { getUiLanguage } from "@/lib/ui-language";
import { randomUUID } from "node:crypto";
import { getDatabase, type DatabaseConnection } from "@/lib/db/client";
import { canAccessChatRoom } from "@/lib/chat";
import { assertSourceAccess, type SourceReference } from "./sources";
import { readAiConfig } from "./config";
import { removeAiAsset } from "./files";
export type AiConversation = {
  id: string;
  owner_user_id: number;
  group_id: number | null;
  room_id: number | null;
  title: string;
  model: string | null;
  created_at: number;
  updated_at: number;
};
export type AiMessage = {
  author_name?: string | null;
  model?: string | null;
  id: string;
  role: "user" | "assistant";
  content: string;
  status: "complete" | "pending" | "interrupted" | "error";
  author_user_id: number | null;
  created_at: number;
};
export type AiSource = {
  id: string;
  kind: string;
  reference: string | null;
  title: string;
  text_content: string;
  asset_key: string | null;
  mime: string | null;
  message_id: string;
};
export function groupMember(
  userId: number,
  groupId: number,
  connection: DatabaseConnection,
) {
  return !!connection.sqlite
    .prepare(
      "SELECT 1 FROM study_group_members m JOIN study_groups g ON g.id=m.group_id JOIN users u ON u.id=m.user_id WHERE m.user_id=? AND m.group_id=? AND g.archived_at IS NULL AND u.active=1",
    )
    .get(userId, groupId);
}
export function canReadConversation(
  userId: number,
  conversation: AiConversation,
  connection: DatabaseConnection,
) {
  if (
    !connection.sqlite
      .prepare("SELECT 1 FROM users WHERE id=? AND active=1")
      .get(userId)
  )
    return false;
  if (conversation.room_id)
    return canAccessChatRoom(userId, conversation.room_id, connection);
  if (conversation.group_id)
    return groupMember(userId, conversation.group_id, connection);
  return (
    conversation.owner_user_id === userId &&
    !!connection.sqlite
      .prepare(
        "SELECT 1 FROM ai_participants WHERE conversation_id=? AND user_id=?",
      )
      .get(conversation.id, userId)
  );
}
export function conversationSources(
  id: string,
  connection: DatabaseConnection,
) {
  return connection.sqlite
    .prepare(
      "SELECT * FROM ai_sources WHERE conversation_id=? ORDER BY created_at,rowid",
    )
    .all(id) as AiSource[];
}
export function assertConversationSources(
  userId: number,
  conversation: AiConversation,
  connection: DatabaseConnection,
) {
  for (const source of conversationSources(conversation.id, connection))
    if (source.reference) {
      if (conversation.room_id && !conversation.group_id)
        throw new Error(
          "Fontes privadas não podem ser usadas no chat global. / Private sources cannot be used in global chat.",
        );
      assertSourceAccess(
        userId,
        JSON.parse(source.reference) as SourceReference,
        conversation.group_id,
        connection,
      );
    }
}
export function getConversation(
  userId: number,
  id: string,
  connection: DatabaseConnection = getDatabase(),
) {
  const conversation = connection.sqlite
    .prepare("SELECT * FROM ai_conversations WHERE id=?")
    .get(id) as AiConversation | undefined;
  if (!conversation || !canReadConversation(userId, conversation, connection))
    throw new Error("Conversa indisponível / Conversation unavailable");
  assertConversationSources(userId, conversation, connection);
  return conversation;
}
export function listConversations(
  userId: number,
  search = "",
  connection: DatabaseConnection = getDatabase(),
) {
  const rows = connection.sqlite
    .prepare(
      `SELECT DISTINCT c.* FROM ai_conversations c LEFT JOIN study_group_members m ON m.group_id=c.group_id AND m.user_id=? WHERE c.room_id IS NULL AND (c.owner_user_id=? OR m.user_id=?) ORDER BY c.updated_at DESC LIMIT 200`,
    )
    .all(userId, userId, userId) as AiConversation[];
  return rows.filter((c) => {
    if (!canReadConversation(userId, c, connection)) return false;
    try {
      assertConversationSources(userId, c, connection);
    } catch {
      return c.owner_user_id === userId && !c.group_id && !search;
    }
    return (
      !search ||
      c.title.toLowerCase().includes(search.toLowerCase()) ||
      !!connection.sqlite
        .prepare(
          "SELECT 1 FROM ai_messages WHERE conversation_id=? AND instr(lower(content),lower(?))>0 LIMIT 1",
        )
        .get(c.id, search.slice(0, 100))
    );
  });
}
const defaultTitles = new Set([
  "Nova conversa",
  "New conversation",
  "Nova conversa / New conversation",
]);
export const isDefaultConversationTitle = (title: string) =>
  defaultTitles.has(title);
export function createConversation(
  userId: number,
  title: string | undefined = undefined,
  connection: DatabaseConnection = getDatabase(),
  groupId: number | null = null,
) {
  if (
    groupId &&
    (!readAiConfig(connection).config.groups ||
      !groupMember(userId, groupId, connection))
  )
    throw new Error("Grupo indisponível / Group unavailable");
  const id = randomUUID(),
    now = Date.now();
  connection.sqlite
    .transaction(() => {
      connection.sqlite
        .prepare(
          "INSERT INTO ai_conversations(id,owner_user_id,group_id,title,created_at,updated_at) VALUES(?,?,?,?,?,?)",
        )
        .run(
          id,
          userId,
          groupId,
          (
            title ??
            (getUiLanguage(connection) === "en"
              ? "New conversation"
              : "Nova conversa")
          ).slice(0, 160),
          now,
          now,
        );
      connection.sqlite
        .prepare("INSERT INTO ai_participants VALUES(?,?,?)")
        .run(id, userId, now);
    })
    .immediate();
  return getConversation(userId, id, connection);
}
export function messagesForConversation(
  userId: number,
  id: string,
  connection: DatabaseConnection = getDatabase(),
) {
  getConversation(userId, id, connection);
  return connection.sqlite
    .prepare(
      "SELECT m.id,m.role,m.content,m.status,m.author_user_id,m.created_at,u.display_name author_name,r.model FROM (SELECT *,rowid sequence FROM ai_messages WHERE conversation_id=? ORDER BY created_at DESC,rowid DESC LIMIT 200) m LEFT JOIN users u ON u.id=m.author_user_id LEFT JOIN ai_requests r ON r.assistant_message_id=m.id ORDER BY m.created_at,m.sequence",
    )
    .all(id) as AiMessage[];
}
export function renameConversation(
  userId: number,
  id: string,
  title: string,
  connection: DatabaseConnection = getDatabase(),
) {
  const c = getConversation(userId, id, connection);
  if (
    c.owner_user_id !== userId ||
    c.room_id ||
    !title.trim() ||
    title.length > 160
  )
    throw new Error("Sem permissão / Not permitted");
  connection.sqlite
    .prepare("UPDATE ai_conversations SET title=?,updated_at=? WHERE id=?")
    .run(title.trim(), Date.now(), id);
}
export async function deleteConversation(
  userId: number,
  id: string,
  connection: DatabaseConnection = getDatabase(),
) {
  const c = connection.sqlite
    .prepare("SELECT * FROM ai_conversations WHERE id=?")
    .get(id) as AiConversation | undefined;
  if (
    !c ||
    !canReadConversation(userId, c, connection) ||
    c.owner_user_id !== userId ||
    c.room_id
  )
    throw new Error("Sem permissão / Not permitted");
  const assets = conversationSources(id, connection).flatMap((s) =>
    s.asset_key ? [s.asset_key] : [],
  );
  connection.sqlite.prepare("DELETE FROM ai_conversations WHERE id=?").run(id);
  for (const key of assets)
    if (
      !connection.sqlite
        .prepare("SELECT 1 FROM ai_sources WHERE asset_key=?")
        .get(key)
    )
      await removeAiAsset(key);
}
export function shareConversation(
  userId: number,
  id: string,
  groupId: number,
  confirmed: boolean,
  connection: DatabaseConnection = getDatabase(),
) {
  if (
    !confirmed ||
    !readAiConfig(connection).config.groups ||
    !groupMember(userId, groupId, connection)
  )
    throw new Error(
      "Confirme o histórico e os anexos do compartilhamento. / Confirm the history and attachments to share.",
    );
  return connection.sqlite
    .transaction(() => {
      const original = getConversation(userId, id, connection);
      if (
        original.owner_user_id !== userId ||
        original.group_id ||
        original.room_id
      )
        throw new Error(
          "Compartilhe uma conversa privada própria. / Share your own private conversation.",
        );
      if (
        connection.sqlite
          .prepare(
            "SELECT 1 FROM ai_requests WHERE conversation_id=? AND status IN ('queued','running')",
          )
          .get(id)
      )
        throw new Error(
          "Aguarde ou interrompa a resposta antes de compartilhar. / Wait or stop generation before sharing.",
        );
      const sources = conversationSources(id, connection);
      for (const source of sources)
        if (source.reference)
          assertSourceAccess(
            userId,
            JSON.parse(source.reference),
            groupId,
            connection,
          );
      const copy = createConversation(
        userId,
        original.title,
        connection,
        groupId,
      );
      connection.sqlite
        .prepare("UPDATE ai_conversations SET model=? WHERE id=?")
        .run(original.model, copy.id);
      const mapping = new Map<string, string>();
      const messages = connection.sqlite
        .prepare(
          "SELECT * FROM ai_messages WHERE conversation_id=? ORDER BY created_at,rowid",
        )
        .all(id) as AiMessage[];
      for (const message of messages) {
        const next = randomUUID();
        mapping.set(message.id, next);
        connection.sqlite
          .prepare(
            "INSERT INTO ai_messages(id,conversation_id,author_user_id,role,content,status,created_at) VALUES(?,?,?,?,?,?,?)",
          )
          .run(
            next,
            copy.id,
            message.author_user_id,
            message.role,
            message.content,
            message.status,
            message.created_at,
          );
      }
      for (const source of sources)
        connection.sqlite
          .prepare(
            "INSERT INTO ai_sources(id,conversation_id,message_id,kind,reference,title,text_content,asset_key,mime,created_at) VALUES(?,?,?,?,?,?,?,?,?,?)",
          )
          .run(
            randomUUID(),
            copy.id,
            mapping.get(source.message_id),
            source.kind,
            source.reference,
            source.title,
            source.text_content,
            source.asset_key,
            source.mime,
            Date.now(),
          );
      return copy;
    })
    .immediate();
}
export function setConversationModel(
  userId: number,
  id: string,
  model: string,
  connection: DatabaseConnection = getDatabase(),
) {
  const conversation = getConversation(userId, id, connection);
  if (
    conversation.room_id ||
    !readAiConfig(connection).config.models.includes(model)
  )
    throw new Error("Modelo indisponível / Model unavailable");
  connection.sqlite
    .prepare("UPDATE ai_conversations SET model=? WHERE id=?")
    .run(model, id);
  return getConversation(userId, id, connection);
}
export function roomConversation(
  userId: number,
  roomId: number,
  connection: DatabaseConnection = getDatabase(),
) {
  const config = readAiConfig(connection).config;
  if (!config.enabled || !canAccessChatRoom(userId, roomId, connection))
    return null;
  const room = connection.sqlite
    .prepare(
      "SELECT r.kind,r.group_id,r.name,a.audience_type FROM chat_rooms r LEFT JOIN chat_room_audiences a ON a.room_id=r.id WHERE r.id=? AND r.archived_at IS NULL",
    )
    .get(roomId) as
    | {
        kind: string;
        group_id: number | null;
        name: string;
        audience_type: string | null;
      }
    | undefined;
  if (
    !room ||
    (room.kind === "group"
      ? !config.groups ||
        !connection.sqlite
          .prepare(
            "SELECT 1 FROM ai_room_permissions WHERE room_id=? AND enabled=1",
          )
          .get(roomId)
      : !(
          room.kind === "audience" &&
          room.audience_type === "instance" &&
          config.global
        ))
  )
    return null;
  let existing = connection.sqlite
    .prepare("SELECT * FROM ai_conversations WHERE room_id=?")
    .get(roomId) as AiConversation | undefined;
  if (!existing) {
    const id = randomUUID();
    connection.sqlite
      .prepare(
        "INSERT OR IGNORE INTO ai_conversations(id,owner_user_id,group_id,room_id,title,created_at,updated_at) VALUES(?,?,?,?,?,?,?)",
      )
      .run(
        id,
        userId,
        room.group_id,
        roomId,
        room.name ?? "Chat",
        Date.now(),
        Date.now(),
      );
    existing = connection.sqlite
      .prepare("SELECT * FROM ai_conversations WHERE room_id=?")
      .get(roomId) as AiConversation;
  }
  return getConversation(userId, existing.id, connection);
}
