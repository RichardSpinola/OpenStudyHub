import { z } from "zod";

import type { DatabaseConnection } from "@/lib/db/client";
import { getDatabase } from "@/lib/db/client";
import { isUserEnrolled } from "@/lib/enrollments";

const idSchema = z.number().int().positive();
export const activityStatusSchema = z.enum([
  "pending",
  "in_progress",
  "completed",
  "submitted",
  "archived",
]);
const activityInputSchema = z.object({
  offeringId: idSchema,
  title: z.string().trim().min(1).max(160),
  description: z
    .string()
    .trim()
    .max(1000)
    .optional()
    .nullable()
    .transform((value) => value || null),
  dueAt: z
    .date()
    .optional()
    .nullable()
    .transform((value) => value ?? null),
  status: activityStatusSchema.default("pending"),
});

export type ActivityRecord = {
  id: number;
  offeringId: number;
  subjectId: number;
  subjectName: string;
  subjectCode: string | null;
  title: string;
  description: string | null;
  dueAt: number | null;
  status: z.infer<typeof activityStatusSchema>;
  origin: "local" | "external";
  externalUrl: string | null;
  createdAt: number;
  updatedAt: number;
};

function assertEnrollment(
  userId: number,
  offeringId: number,
  connection: DatabaseConnection,
) {
  if (!isUserEnrolled(userId, offeringId, connection)) {
    throw new Error("Offering is outside the user's academic context.");
  }
}

export function listUserActivities(
  userId: number,
  connection: DatabaseConnection = getDatabase(),
): ActivityRecord[] {
  return connection.sqlite
    .prepare(
      `select a.id, a.offering_id as offeringId, s.id as subjectId,
              s.name as subjectName,
              s.code as subjectCode, a.title, a.description, a.due_at as dueAt,
              a.status, a.origin, a.external_url as externalUrl,
              a.created_at as createdAt,
              a.updated_at as updatedAt
       from activities a
       join enrollments e
         on e.user_id = a.user_id and e.offering_id = a.offering_id
       join subject_offerings so on so.id = a.offering_id
       join subjects s on s.id = so.subject_id
       where a.user_id = ? and a.status != 'archived'
       order by a.due_at is null, a.due_at, a.created_at desc`,
    )
    .all(idSchema.parse(userId)) as ActivityRecord[];
}

export function createActivity(
  userId: number,
  input: z.input<typeof activityInputSchema>,
  connection: DatabaseConnection = getDatabase(),
) {
  const ownerId = idSchema.parse(userId);
  const value = activityInputSchema.parse(input);
  assertEnrollment(ownerId, value.offeringId, connection);
  const now = Date.now();
  const result = connection.sqlite
    .prepare(
      `insert into activities
       (user_id, offering_id, title, description, due_at, status, origin,
        created_at, updated_at)
       values (?, ?, ?, ?, ?, ?, 'local', ?, ?)`,
    )
    .run(
      ownerId,
      value.offeringId,
      value.title,
      value.description,
      value.dueAt?.getTime() ?? null,
      value.status,
      now,
      now,
    );
  return Number(result.lastInsertRowid);
}

export function updateActivity(
  userId: number,
  activityId: number,
  input: z.input<typeof activityInputSchema>,
  connection: DatabaseConnection = getDatabase(),
) {
  const ownerId = idSchema.parse(userId);
  const id = idSchema.parse(activityId);
  const value = activityInputSchema.parse(input);
  assertEnrollment(ownerId, value.offeringId, connection);
  const result = connection.sqlite
    .prepare(
      `update activities
       set offering_id = ?, title = ?, description = ?, due_at = ?,
           status = ?, updated_at = ?
       where id = ? and user_id = ? and origin = 'local'`,
    )
    .run(
      value.offeringId,
      value.title,
      value.description,
      value.dueAt?.getTime() ?? null,
      value.status,
      Date.now(),
      id,
      ownerId,
    );
  if (result.changes !== 1) throw new Error("Activity not found.");
}

export function setActivityStatus(
  userId: number,
  activityId: number,
  status: z.input<typeof activityStatusSchema>,
  connection: DatabaseConnection = getDatabase(),
) {
  const result = connection.sqlite
    .prepare(
      `update activities set status = ?, updated_at = ?
       where id = ? and user_id = ? and origin = 'local'
         and exists (
           select 1 from enrollments e
           where e.user_id = activities.user_id
             and e.offering_id = activities.offering_id
         )`,
    )
    .run(
      activityStatusSchema.parse(status),
      Date.now(),
      idSchema.parse(activityId),
      idSchema.parse(userId),
    );
  if (result.changes !== 1) throw new Error("Activity not found.");
}
