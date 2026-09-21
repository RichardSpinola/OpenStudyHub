import { z } from "zod";

import type { DatabaseConnection } from "@/lib/db/client";
import { getDatabase } from "@/lib/db/client";

const auditEventSchema = z.object({
  actorUserId: z.number().int().positive().nullable(),
  action: z.string().trim().min(1).max(80),
  targetType: z.string().trim().min(1).max(80),
  targetId: z.string().trim().max(120).nullable(),
  summary: z.string().trim().max(500).nullable(),
});

export type AuditEventInput = z.input<typeof auditEventSchema>;

export function recordAuditEvent(
  input: AuditEventInput,
  connection: DatabaseConnection = getDatabase(),
): number {
  const value = auditEventSchema.parse(input);
  const result = connection.sqlite
    .prepare(
      `insert into audit_events
       (actor_user_id, action, target_type, target_id, summary, created_at)
       values (?, ?, ?, ?, ?, ?)`,
    )
    .run(
      value.actorUserId,
      value.action,
      value.targetType,
      value.targetId,
      value.summary,
      Date.now(),
    );

  return Number(result.lastInsertRowid);
}

export type AuditEventRecord = {
  id: number;
  actorDisplayName: string | null;
  action: string;
  targetType: string;
  targetId: string | null;
  summary: string | null;
  createdAt: number;
};

export function listRecentAuditEvents(
  limit = 50,
  connection: DatabaseConnection = getDatabase(),
): AuditEventRecord[] {
  const safeLimit = z.number().int().min(1).max(200).parse(limit);
  return connection.sqlite
    .prepare(
      `select
         ae.id as id,
         u.display_name as actorDisplayName,
         ae.action as action,
         ae.target_type as targetType,
         ae.target_id as targetId,
         ae.summary as summary,
         ae.created_at as createdAt
       from audit_events ae
       left join users u on u.id = ae.actor_user_id
       order by ae.created_at desc, ae.id desc
       limit ?`,
    )
    .all(safeLimit) as AuditEventRecord[];
}
