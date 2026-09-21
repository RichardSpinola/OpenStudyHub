import { z } from "zod";

import type { DatabaseConnection } from "@/lib/db/client";
import { getDatabase } from "@/lib/db/client";

const idSchema = z.number().int().positive();
export const notificationPreferencesSchema = z.object({
  desktopEnabled: z.boolean().default(false),
  dm: z.enum(["all", "mentions", "none"]).default("all"),
  groupDefault: z.enum(["all", "mentions", "none"]).default("all"),
  audienceDefault: z.enum(["all", "mentions", "none"]).default("all"),
  mentionsEnabled: z.boolean().default(true),
  repliesEnabled: z.boolean().default(true),
});
export type NotificationPreferences = z.infer<
  typeof notificationPreferencesSchema
>;

export const defaultNotificationPreferences: NotificationPreferences =
  notificationPreferencesSchema.parse({});

export type NotificationRecord = {
  id: number;
  type: string;
  actorUserId: number | null;
  actorName: string | null;
  entityType: string;
  entityId: string;
  title: string;
  bodyPreview: string | null;
  readAt: number | null;
  createdAt: number;
};

export function createNotification(
  userId: number,
  input: {
    type: string;
    actorUserId?: number | null;
    entityType: string;
    entityId: string | number;
    title: string;
    bodyPreview?: string | null;
  },
  connection: DatabaseConnection = getDatabase(),
): void {
  const recipientId = idSchema.parse(userId);
  if (input.actorUserId === recipientId) return;
  connection.sqlite
    .prepare(
      `insert into notifications
       (user_id, type, actor_user_id, entity_type, entity_id, title,
        body_preview, created_at)
       values (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      recipientId,
      z.string().trim().min(1).max(80).parse(input.type),
      input.actorUserId ?? null,
      z.string().trim().min(1).max(80).parse(input.entityType),
      String(input.entityId).slice(0, 120),
      z.string().trim().min(1).max(180).parse(input.title),
      input.bodyPreview?.trim().slice(0, 300) || null,
      Date.now(),
    );
}

export function listNotifications(
  userId: number,
  afterId = 0,
  connection: DatabaseConnection = getDatabase(),
): NotificationRecord[] {
  return connection.sqlite
    .prepare(
      `select n.id, n.type, n.actor_user_id as actorUserId,
              u.display_name as actorName, n.entity_type as entityType,
              n.entity_id as entityId, n.title,
              n.body_preview as bodyPreview, n.read_at as readAt,
              n.created_at as createdAt
       from notifications n
       left join users u on u.id = n.actor_user_id
       where n.user_id = ? and n.id > ?
       order by n.id desc limit 100`,
    )
    .all(
      idSchema.parse(userId),
      z.number().int().min(0).parse(afterId),
    ) as NotificationRecord[];
}

export function countUnreadNotifications(
  userId: number,
  connection: DatabaseConnection = getDatabase(),
): number {
  return (
    connection.sqlite
      .prepare(
        "select count(*) as count from notifications where user_id = ? and read_at is null",
      )
      .get(idSchema.parse(userId)) as { count: number }
  ).count;
}

export function markNotificationRead(
  userId: number,
  notificationId: number,
  connection: DatabaseConnection = getDatabase(),
): void {
  connection.sqlite
    .prepare(
      "update notifications set read_at = coalesce(read_at, ?) where id = ? and user_id = ?",
    )
    .run(Date.now(), idSchema.parse(notificationId), idSchema.parse(userId));
}

export function getNotificationPreferences(
  userId: number,
  connection: DatabaseConnection = getDatabase(),
): NotificationPreferences {
  const row = connection.sqlite
    .prepare(
      "select notification_preferences_json as value from users where id = ? and active = 1",
    )
    .get(idSchema.parse(userId)) as { value: string } | undefined;
  if (!row) throw new Error("Profile not found.");
  try {
    return notificationPreferencesSchema.parse(JSON.parse(row.value));
  } catch {
    return notificationPreferencesSchema.parse({});
  }
}

export function updateNotificationPreferences(
  userId: number,
  input: NotificationPreferences,
  connection: DatabaseConnection = getDatabase(),
): NotificationPreferences {
  const value = notificationPreferencesSchema.parse(input);
  const result = connection.sqlite
    .prepare(
      `update users set notification_preferences_json = ?, updated_at = ?
       where id = ? and active = 1`,
    )
    .run(JSON.stringify(value), Date.now(), idSchema.parse(userId));
  if (result.changes !== 1) throw new Error("Profile not found.");
  return value;
}
