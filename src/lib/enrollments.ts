import { z } from "zod";

import { assertCanManageEnrollments } from "@/lib/academic-authority";
import { getAcademicMembership } from "@/lib/academic-membership";
import { recordAuditEvent } from "@/lib/audit";
import type { DatabaseConnection } from "@/lib/db/client";
import { getDatabase } from "@/lib/db/client";

const idSchema = z.number().int().positive();
const idsSchema = z.array(idSchema).max(500);

export type EnrollmentOffering = {
  offeringId: number;
  programId: number;
  subjectName: string;
  subjectCode: string | null;
  periodLabel: string;
  classGroup: string | null;
};

export function listEnrollmentOfferings(
  connection: DatabaseConnection = getDatabase(),
): EnrollmentOffering[] {
  return connection.sqlite
    .prepare(
      `select so.id as offeringId, so.program_id as programId,
              s.name as subjectName, s.code as subjectCode,
              ap.label as periodLabel, so.class_group as classGroup
       from subject_offerings so
       join subjects s on s.id = so.subject_id
       join academic_periods ap on ap.id = so.academic_period_id
       where s.active = 1 and ap.active = 1 and so.status != 'cancelled'
       order by s.name collate nocase, ap.starts_on desc, so.id`,
    )
    .all() as EnrollmentOffering[];
}

export function listUserEnrollmentIds(
  userId: number,
  connection: DatabaseConnection = getDatabase(),
): number[] {
  return (
    connection.sqlite
      .prepare(
        `select offering_id as offeringId
         from enrollments where user_id = ? order by offering_id`,
      )
      .all(idSchema.parse(userId)) as Array<{ offeringId: number }>
  ).map(({ offeringId }) => offeringId);
}

export function isUserEnrolled(
  userId: number,
  offeringId: number,
  connection: DatabaseConnection = getDatabase(),
): boolean {
  return Boolean(
    connection.sqlite
      .prepare(
        `select 1 from enrollments
         where user_id = ? and offering_id = ?`,
      )
      .get(idSchema.parse(userId), idSchema.parse(offeringId)),
  );
}

export function replaceUserEnrollments(
  actorUserId: number,
  targetUserId: number,
  offeringIds: number[],
  connection: DatabaseConnection = getDatabase(),
): number[] {
  const actor = idSchema.parse(actorUserId);
  const target = idSchema.parse(targetUserId);
  const ids = [...new Set(idsSchema.parse(offeringIds))];

  assertCanManageEnrollments(actor, target, connection);

  const targetExists = connection.sqlite
    .prepare("select 1 from users where id = ? and active = 1")
    .get(target);
  if (!targetExists) throw new Error("User not found.");
  const membership = getAcademicMembership(target, connection);
  if (!membership) throw new Error("Academic membership is required.");
  if (ids.length > 0) {
    const placeholders = ids.map(() => "?").join(",");
    const compatible = connection.sqlite
      .prepare(
        `select count(*) as count
         from subject_offerings so
         join subjects s on s.id = so.subject_id
         join academic_periods ap on ap.id = so.academic_period_id
         where so.id in (${placeholders})
           and so.program_id = ?
           and so.status != 'cancelled'
           and s.active = 1
           and ap.active = 1`,
      )
      .get(...ids, membership.programId) as { count: number };
    if (compatible.count !== ids.length) {
      throw new Error("Enrollment offering is outside the user's program.");
    }
  }

  const replace = connection.sqlite.transaction(() => {
    connection.sqlite
      .prepare("delete from enrollments where user_id = ?")
      .run(target);
    const insert = connection.sqlite.prepare(
      "insert into enrollments (user_id, offering_id) values (?, ?)",
    );
    for (const offeringId of ids) insert.run(target, offeringId);
    recordAuditEvent(
      {
        actorUserId: actor,
        action: "enrollment.replace",
        targetType: "user",
        targetId: String(target),
        summary: `${ids.length} enrollment(s) assigned`,
      },
      connection,
    );
  });
  replace();
  return ids;
}
