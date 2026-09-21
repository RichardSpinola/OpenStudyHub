import { z } from "zod";

import { getAcademicAuthority } from "@/lib/academic-authority";
import { recordAuditEvent } from "@/lib/audit";
import { canViewUser } from "@/lib/collaboration";
import type { DatabaseConnection } from "@/lib/db/client";
import { getDatabase } from "@/lib/db/client";
import {
  createNotification,
  getNotificationPreferences,
} from "@/lib/notifications";

const idSchema = z.number().int().positive();
const messageTextSchema = z.string().trim().max(10_000);
const messageSchema = messageTextSchema.refine((value) => value.length > 0);

export type ChatRoom = {
  id: number;
  kind: "direct" | "group" | "audience";
  name: string;
  groupId: number | null;
  lastMessageAt: number | null;
};

export type ChatMessage = {
  id: number;
  roomId: number;
  authorUserId: number;
  authorName: string;
  bodySource: string;
  replyToMessageId: number | null;
  replyBody: string | null;
  editedAt: number | null;
  createdAt: number;
  attachmentIds: number[];
};

function hasAudienceAccess(
  userId: number,
  roomId: number,
  connection: DatabaseConnection,
): boolean {
  const authority = getAcademicAuthority(userId, connection);
  if (authority.role === "admin") return true;
  const audience = connection.sqlite
    .prepare(
      `select a.audience_type as audienceType, a.program_id as programId,
              a.cohort_id as cohortId, c.program_id as cohortProgramId
       from chat_room_audiences a
       left join cohorts c on c.id = a.cohort_id
       where a.room_id = ?`,
    )
    .get(roomId) as
    | {
        audienceType: "instance" | "program" | "cohort";
        programId: number | null;
        cohortId: number | null;
        cohortProgramId: number | null;
      }
    | undefined;
  if (
    audience &&
    authority.role === "moderator" &&
    ((audience.audienceType === "program" &&
      audience.programId !== null &&
      authority.programIds.includes(audience.programId)) ||
      (audience.audienceType === "cohort" &&
        audience.cohortProgramId !== null &&
        authority.programIds.includes(audience.cohortProgramId)))
  )
    return true;
  if (
    audience?.audienceType === "cohort" &&
    audience.cohortId !== null &&
    authority.role === "curator" &&
    authority.cohortIds.includes(audience.cohortId)
  )
    return true;
  return Boolean(
    connection.sqlite
      .prepare(
        `select 1 from chat_room_audiences a
         where a.room_id = ? and (
           a.audience_type = 'instance'
           or (a.audience_type = 'program' and exists (
             select 1 from user_academic_memberships m
             where m.user_id = ? and m.program_id = a.program_id
           ))
           or (a.audience_type = 'cohort' and exists (
             select 1 from user_academic_memberships m
             where m.user_id = ? and m.cohort_id = a.cohort_id
           ))
         )`,
      )
      .get(roomId, userId, userId),
  );
}

export function canAccessChatRoom(
  userId: number,
  roomId: number,
  connection: DatabaseConnection = getDatabase(),
): boolean {
  const actorId = idSchema.parse(userId);
  const targetRoomId = idSchema.parse(roomId);
  const room = connection.sqlite
    .prepare(
      "select kind, group_id as groupId from chat_rooms where id = ? and archived_at is null",
    )
    .get(targetRoomId) as
    { kind: ChatRoom["kind"]; groupId: number | null } | undefined;
  if (!room) return false;
  if (room.kind === "direct") {
    return Boolean(
      connection.sqlite
        .prepare(
          "select 1 from chat_direct_members where room_id = ? and user_id = ?",
        )
        .get(targetRoomId, actorId),
    );
  }
  if (room.kind === "group") {
    return Boolean(
      connection.sqlite
        .prepare(
          "select 1 from study_group_members where group_id = ? and user_id = ?",
        )
        .get(room.groupId, actorId),
    );
  }
  return hasAudienceAccess(actorId, targetRoomId, connection);
}

export function listChatRooms(
  userId: number,
  connection: DatabaseConnection = getDatabase(),
): ChatRoom[] {
  const actorId = idSchema.parse(userId);
  const rooms = connection.sqlite
    .prepare(
      `select r.id, r.kind, r.group_id as groupId,
              coalesce(r.name, (
                select group_concat(u.display_name, ', ')
                from chat_direct_members dm join users u on u.id = dm.user_id
                where dm.room_id = r.id and dm.user_id != ?
              ), 'Conversa') as name,
              (select max(m.created_at) from chat_messages m where m.room_id = r.id) as lastMessageAt
       from chat_rooms r where r.archived_at is null order by coalesce(lastMessageAt, r.created_at) desc`,
    )
    .all(actorId) as ChatRoom[];
  return rooms.filter(({ id }) => canAccessChatRoom(actorId, id, connection));
}

export function createDirectRoom(
  userId: number,
  targetUserId: number,
  connection: DatabaseConnection = getDatabase(),
): ChatRoom {
  const actorId = idSchema.parse(userId);
  const targetId = idSchema.parse(targetUserId);
  if (actorId === targetId || !canViewUser(actorId, targetId, connection)) {
    throw new Error("Forbidden.");
  }
  const existing = connection.sqlite
    .prepare(
      `select r.id from chat_rooms r
       join chat_direct_members a on a.room_id = r.id and a.user_id = ?
       join chat_direct_members b on b.room_id = r.id and b.user_id = ?
       where r.kind = 'direct' and r.archived_at is null
         and (select count(*) from chat_direct_members x where x.room_id = r.id) = 2`,
    )
    .get(actorId, targetId) as { id: number } | undefined;
  const roomId =
    existing?.id ??
    connection.sqlite.transaction(() => {
      const now = Date.now();
      const id = Number(
        connection.sqlite
          .prepare(
            "insert into chat_rooms (kind, created_by_user_id, created_at) values ('direct', ?, ?)",
          )
          .run(actorId, now).lastInsertRowid,
      );
      const add = connection.sqlite.prepare(
        "insert into chat_direct_members (room_id, user_id) values (?, ?)",
      );
      add.run(id, actorId);
      add.run(id, targetId);
      return id;
    })();
  return listChatRooms(actorId, connection).find(({ id }) => id === roomId)!;
}

export function createAudienceRoom(
  userId: number,
  input: {
    name: string;
    audienceType: "instance" | "program" | "cohort";
    programId?: number | null;
    cohortId?: number | null;
  },
  connection: DatabaseConnection = getDatabase(),
): ChatRoom {
  const actorId = idSchema.parse(userId);
  const value = z
    .object({
      name: z.string().trim().min(1).max(120),
      audienceType: z.enum(["instance", "program", "cohort"]),
      programId: idSchema.nullish(),
      cohortId: idSchema.nullish(),
    })
    .parse(input);
  const authority = getAcademicAuthority(actorId, connection);
  const allowed =
    authority.role === "admin" ||
    (value.audienceType === "program" &&
      value.programId !== null &&
      value.programId !== undefined &&
      authority.role === "moderator" &&
      authority.programIds.includes(value.programId)) ||
    (value.audienceType === "cohort" &&
      value.cohortId !== null &&
      value.cohortId !== undefined &&
      authority.role === "curator" &&
      authority.cohortIds.includes(value.cohortId));
  if (
    !allowed ||
    (value.audienceType === "instance" && authority.role !== "admin")
  ) {
    throw new Error("Forbidden.");
  }
  const roomId = connection.sqlite.transaction(() => {
    const id = Number(
      connection.sqlite
        .prepare(
          "insert into chat_rooms (kind, name, created_by_user_id) values ('audience', ?, ?)",
        )
        .run(value.name, actorId).lastInsertRowid,
    );
    connection.sqlite
      .prepare(
        `insert into chat_room_audiences
         (room_id, audience_type, program_id, cohort_id) values (?, ?, ?, ?)`,
      )
      .run(
        id,
        value.audienceType,
        value.programId ?? null,
        value.cohortId ?? null,
      );
    return id;
  })();
  return listChatRooms(actorId, connection).find(({ id }) => id === roomId)!;
}

function roomMemberIds(
  roomId: number,
  connection: DatabaseConnection,
): number[] {
  const room = connection.sqlite
    .prepare("select kind, group_id as groupId from chat_rooms where id = ?")
    .get(roomId) as { kind: ChatRoom["kind"]; groupId: number | null };
  if (room.kind === "direct") {
    return (
      connection.sqlite
        .prepare(
          "select user_id as id from chat_direct_members where room_id = ?",
        )
        .all(roomId) as Array<{ id: number }>
    ).map(({ id }) => id);
  }
  if (room.kind === "group") {
    return (
      connection.sqlite
        .prepare(
          "select user_id as id from study_group_members where group_id = ?",
        )
        .all(room.groupId) as Array<{ id: number }>
    ).map(({ id }) => id);
  }
  return (
    connection.sqlite
      .prepare(
        `select distinct u.id from users u
       where u.active = 1 and exists (
         select 1 from chat_room_audiences a where a.room_id = ? and (
           a.audience_type = 'instance' or
           (a.audience_type = 'program' and exists (
             select 1 from user_academic_memberships m where m.user_id = u.id and m.program_id = a.program_id
           )) or
           (a.audience_type = 'cohort' and exists (
             select 1 from user_academic_memberships m where m.user_id = u.id and m.cohort_id = a.cohort_id
           ))
         )
       )`,
      )
      .all(roomId) as Array<{ id: number }>
  ).map(({ id }) => id);
}

export function listChatRoomUsers(
  userId: number,
  roomId: number,
  connection: DatabaseConnection = getDatabase(),
): Array<{
  id: number;
  displayName: string;
  bio: string;
  hasAvatar: boolean;
  programName: string | null;
  cohortName: string | null;
  tags: string[];
}> {
  if (!canAccessChatRoom(userId, roomId, connection)) {
    throw new Error("Forbidden.");
  }
  const ids = roomMemberIds(roomId, connection);
  if (!ids.length) return [];
  const placeholders = ids.map(() => "?").join(",");
  const rows = connection.sqlite
    .prepare(
      `select u.id, u.display_name as displayName, u.bio,
              case when u.avatar_storage_name is null then 0 else 1 end as hasAvatar,
              p.name as programName, c.name as cohortName,
              group_concat(pt.label, char(31)) as tags
       from users u
       left join user_academic_memberships m on m.user_id = u.id
       left join programs p on p.id = m.program_id
       left join cohorts c on c.id = m.cohort_id
       left join user_profile_tags upt on upt.user_id = u.id
       left join profile_tags pt on pt.id = upt.tag_id and pt.archived_at is null
       where u.active = 1 and u.id in (${placeholders})
       group by u.id
       order by u.display_name collate nocase limit 200`,
    )
    .all(...ids) as Array<{
    id: number;
    displayName: string;
    bio: string;
    hasAvatar: number;
    programName: string | null;
    cohortName: string | null;
    tags: string | null;
  }>;
  return rows.map((row) => ({
    ...row,
    hasAvatar: Boolean(row.hasAvatar),
    tags: row.tags ? row.tags.split(String.fromCharCode(31)) : [],
  }));
}

function resolvedMentions(body: string, allowedUserIds: Set<number>): number[] {
  const ids = [...body.matchAll(/\(user:(\d+)\)/gu)]
    .map((match) => Number(match[1]))
    .filter((id) => allowedUserIds.has(id));
  return [...new Set(ids)];
}

export function sendChatMessage(
  userId: number,
  roomId: number,
  input: {
    body: string;
    replyToMessageId?: number | null;
    hasAttachment?: boolean;
  },
  connection: DatabaseConnection = getDatabase(),
): ChatMessage {
  const actorId = idSchema.parse(userId);
  const targetRoomId = idSchema.parse(roomId);
  if (!canAccessChatRoom(actorId, targetRoomId, connection))
    throw new Error("Forbidden.");
  const body = messageTextSchema.parse(input.body);
  if (!body && !input.hasAttachment) throw new Error("Message is empty.");
  const replyId = input.replyToMessageId
    ? idSchema.parse(input.replyToMessageId)
    : null;
  if (
    replyId &&
    !connection.sqlite
      .prepare(
        "select 1 from chat_messages where id = ? and room_id = ? and deleted_at is null",
      )
      .get(replyId, targetRoomId)
  )
    throw new Error("Invalid reply.");
  const members = roomMemberIds(targetRoomId, connection);
  const mentions = resolvedMentions(body, new Set(members));
  const messageId = connection.sqlite.transaction(() => {
    const id = Number(
      connection.sqlite
        .prepare(
          `insert into chat_messages
           (room_id, author_user_id, body_source, reply_to_message_id)
           values (?, ?, ?, ?)`,
        )
        .run(targetRoomId, actorId, body, replyId).lastInsertRowid,
    );
    const addMention = connection.sqlite.prepare(
      "insert into chat_message_mentions (message_id, mentioned_user_id) values (?, ?)",
    );
    for (const mentionedId of mentions) addMention.run(id, mentionedId);
    return id;
  })();
  const room = connection.sqlite
    .prepare("select kind, name from chat_rooms where id = ?")
    .get(targetRoomId) as { kind: ChatRoom["kind"]; name: string | null };
  const replyAuthorId = replyId
    ? ((
        connection.sqlite
          .prepare(
            "select author_user_id as id from chat_messages where id = ?",
          )
          .get(replyId) as { id: number } | undefined
      )?.id ?? null)
    : null;
  for (const memberId of members) {
    if (memberId === actorId) continue;
    const prefs = getNotificationPreferences(memberId, connection);
    const mentioned = mentions.includes(memberId);
    if (replyAuthorId === memberId && prefs.repliesEnabled) {
      createNotification(
        memberId,
        {
          type: "chat_reply",
          actorUserId: actorId,
          entityType: "chat_room",
          entityId: targetRoomId,
          title: "Nova resposta à sua mensagem",
          bodyPreview: (body || "Imagem").slice(0, 160),
        },
        connection,
      );
      continue;
    }
    const setting =
      room.kind === "direct"
        ? prefs.dm
        : room.kind === "group"
          ? prefs.groupDefault
          : prefs.audienceDefault;
    if (
      setting === "none" ||
      (setting === "mentions" && (!mentioned || !prefs.mentionsEnabled))
    )
      continue;
    createNotification(
      memberId,
      {
        type:
          mentioned && prefs.mentionsEnabled ? "chat_mention" : "chat_message",
        actorUserId: actorId,
        entityType: "chat_room",
        entityId: targetRoomId,
        title: room.name ? `Nova mensagem em ${room.name}` : "Nova mensagem",
        bodyPreview: (body || "Imagem").slice(0, 160),
      },
      connection,
    );
  }
  recordAuditEvent(
    {
      actorUserId: actorId,
      action: "chat.message.create",
      targetType: "chat_room",
      targetId: String(targetRoomId),
      summary: "chat message created",
    },
    connection,
  );
  return listChatMessages(actorId, targetRoomId, 0, connection).find(
    ({ id }) => id === messageId,
  )!;
}

export function listChatMessages(
  userId: number,
  roomId: number,
  afterId = 0,
  connection: DatabaseConnection = getDatabase(),
): ChatMessage[] {
  const actorId = idSchema.parse(userId);
  const targetRoomId = idSchema.parse(roomId);
  if (!canAccessChatRoom(actorId, targetRoomId, connection))
    throw new Error("Forbidden.");
  const messages = connection.sqlite
    .prepare(
      `select m.id, m.room_id as roomId, m.author_user_id as authorUserId,
              u.display_name as authorName, m.body_source as bodySource,
              m.reply_to_message_id as replyToMessageId,
              reply.body_source as replyBody, m.edited_at as editedAt,
              m.created_at as createdAt
       from chat_messages m join users u on u.id = m.author_user_id
       left join chat_messages reply on reply.id = m.reply_to_message_id
       where m.room_id = ? and m.id > ? and m.deleted_at is null
       order by m.id asc limit 200`,
    )
    .all(targetRoomId, z.number().int().min(0).parse(afterId)) as Array<
    Omit<ChatMessage, "attachmentIds">
  >;
  const attachments = connection.sqlite.prepare(
    "select id from chat_attachments where message_id = ? order by id",
  );
  return messages.map((message) => ({
    ...message,
    attachmentIds: (attachments.all(message.id) as Array<{ id: number }>).map(
      ({ id }) => id,
    ),
  }));
}

export function editChatMessage(
  userId: number,
  messageId: number,
  bodyInput: string,
  connection: DatabaseConnection = getDatabase(),
): void {
  const result = connection.sqlite
    .prepare(
      `update chat_messages set body_source = ?, edited_at = ?
       where id = ? and author_user_id = ? and deleted_at is null`,
    )
    .run(
      messageSchema.parse(bodyInput),
      Date.now(),
      idSchema.parse(messageId),
      idSchema.parse(userId),
    );
  if (result.changes !== 1) throw new Error("Message not found.");
}

export function deleteChatMessage(
  userId: number,
  messageId: number,
  connection: DatabaseConnection = getDatabase(),
): void {
  const result = connection.sqlite
    .prepare(
      `update chat_messages set deleted_at = ?
       where id = ? and author_user_id = ? and deleted_at is null`,
    )
    .run(Date.now(), idSchema.parse(messageId), idSchema.parse(userId));
  if (result.changes !== 1) throw new Error("Message not found.");
}
