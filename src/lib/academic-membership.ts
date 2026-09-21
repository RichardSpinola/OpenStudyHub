import { z } from "zod";

import {
  assertCanAssignAcademicMembership,
  assertCanClearAcademicMembership,
  assertCanManageCohort,
  assertCanManageProgram,
} from "@/lib/academic-authority";
import { recordAuditEvent } from "@/lib/audit";
import type { DatabaseConnection } from "@/lib/db/client";
import { getDatabase } from "@/lib/db/client";

const idSchema = z.number().int().positive();
const optionalIdSchema = idSchema
  .optional()
  .nullable()
  .transform((value) => value ?? null);
const cohortInputSchema = z.object({
  programId: idSchema,
  code: z
    .string()
    .trim()
    .max(40)
    .optional()
    .nullable()
    .transform((value) => value || null),
  name: z.string().trim().min(1).max(160),
  active: z.boolean().default(true),
});

export type CohortRecord = {
  id: number;
  programId: number;
  programName: string;
  code: string | null;
  name: string;
  active: boolean;
};

export type AcademicMembership = {
  userId: number;
  programId: number;
  programName: string;
  cohortId: number | null;
  cohortName: string | null;
};

export function listCohorts(
  connection: DatabaseConnection = getDatabase(),
): CohortRecord[] {
  const rows = connection.sqlite
    .prepare(
      `select c.id, c.program_id as programId, p.name as programName,
              c.code, c.name, c.active
       from cohorts c join programs p on p.id = c.program_id
       order by p.name collate nocase, c.name collate nocase, c.id`,
    )
    .all() as Array<Omit<CohortRecord, "active"> & { active: number }>;
  return rows.map((row) => ({ ...row, active: Boolean(row.active) }));
}

export function createCohort(
  actorUserId: number,
  input: z.input<typeof cohortInputSchema>,
  connection: DatabaseConnection = getDatabase(),
): number {
  const value = cohortInputSchema.parse(input);
  return connection.sqlite
    .transaction(() => {
      assertCanManageProgram(actorUserId, value.programId, connection);
      const now = Date.now();
      const result = connection.sqlite
        .prepare(
          `insert into cohorts
         (program_id, code, name, active, created_at, updated_at)
         values (?, ?, ?, ?, ?, ?)`,
        )
        .run(
          value.programId,
          value.code,
          value.name,
          Number(value.active),
          now,
          now,
        );
      const cohortId = Number(result.lastInsertRowid);
      recordAuditEvent(
        {
          actorUserId,
          action: "academic.cohort_create",
          targetType: "cohort",
          targetId: String(cohortId),
          summary: null,
        },
        connection,
      );
      return cohortId;
    })
    .immediate();
}

export function updateCohort(
  actorUserId: number,
  cohortId: number,
  input: z.input<typeof cohortInputSchema>,
  connection: DatabaseConnection = getDatabase(),
): void {
  const id = idSchema.parse(cohortId);
  const value = cohortInputSchema.parse(input);
  connection.sqlite
    .transaction(() => {
      assertCanManageCohort(actorUserId, id, connection);
      const current = connection.sqlite
        .prepare("select program_id as programId from cohorts where id = ?")
        .get(id) as { programId: number } | undefined;
      if (!current) throw new Error("Cohort not found.");
      if (current.programId !== value.programId) {
        assertCanManageProgram(actorUserId, value.programId, connection);
      }
      const incompatibleMembership = connection.sqlite
        .prepare(
          `select 1 from user_academic_memberships
         where cohort_id = ? and program_id != ? limit 1`,
        )
        .get(id, value.programId);
      if (incompatibleMembership) {
        throw new Error("Assigned cohort cannot move to another program.");
      }
      const result = connection.sqlite
        .prepare(
          `update cohorts set program_id = ?, code = ?, name = ?, active = ?,
                            updated_at = ? where id = ?`,
        )
        .run(
          value.programId,
          value.code,
          value.name,
          Number(value.active),
          Date.now(),
          id,
        );
      if (result.changes !== 1) throw new Error("Cohort not found.");
      recordAuditEvent(
        {
          actorUserId,
          action: "academic.cohort_update",
          targetType: "cohort",
          targetId: String(id),
          summary: null,
        },
        connection,
      );
    })
    .immediate();
}

export function getAcademicMembership(
  userId: number,
  connection: DatabaseConnection = getDatabase(),
): AcademicMembership | null {
  return (
    (connection.sqlite
      .prepare(
        `select m.user_id as userId, m.program_id as programId,
                p.name as programName, m.cohort_id as cohortId,
                c.name as cohortName
         from user_academic_memberships m
         join programs p on p.id = m.program_id
         left join cohorts c on c.id = m.cohort_id
         where m.user_id = ?`,
      )
      .get(idSchema.parse(userId)) as AcademicMembership | undefined) ?? null
  );
}

function validateCohortProgram(
  programId: number,
  cohortId: number | null,
  connection: DatabaseConnection,
) {
  if (cohortId === null) return;
  const cohort = connection.sqlite
    .prepare(
      "select program_id as programId from cohorts where id = ? and active = 1",
    )
    .get(cohortId) as { programId: number } | undefined;
  if (!cohort || cohort.programId !== programId) {
    throw new Error("Cohort does not belong to the selected program.");
  }
}

export function setAcademicMembership(
  actorUserId: number,
  targetUserId: number,
  programIdInput: number,
  cohortIdInput: number | null,
  connection: DatabaseConnection = getDatabase(),
): void {
  const target = idSchema.parse(targetUserId);
  const programId = idSchema.parse(programIdInput);
  const cohortId = optionalIdSchema.parse(cohortIdInput);
  validateCohortProgram(programId, cohortId, connection);
  assertCanAssignAcademicMembership(
    actorUserId,
    target,
    programId,
    cohortId,
    connection,
  );

  connection.sqlite.transaction(() => {
    connection.sqlite
      .prepare(
        `insert into user_academic_memberships
         (user_id, program_id, cohort_id, updated_at)
         values (?, ?, ?, ?)
         on conflict(user_id) do update set
           program_id = excluded.program_id,
           cohort_id = excluded.cohort_id,
           updated_at = excluded.updated_at`,
      )
      .run(target, programId, cohortId, Date.now());
    connection.sqlite
      .prepare(
        `delete from enrollments
         where user_id = ? and offering_id in (
           select id from subject_offerings where program_id != ?
         )`,
      )
      .run(target, programId);
    recordAuditEvent(
      {
        actorUserId,
        action: "academic_membership.update",
        targetType: "user",
        targetId: String(target),
        summary:
          cohortId === null
            ? "program assigned"
            : "program and cohort assigned",
      },
      connection,
    );
  })();
}

export function clearAcademicMembership(
  actorUserId: number,
  targetUserId: number,
  connection: DatabaseConnection = getDatabase(),
): void {
  const target = idSchema.parse(targetUserId);
  assertCanClearAcademicMembership(actorUserId, target, connection);
  connection.sqlite
    .transaction(() => {
      connection.sqlite
        .prepare("delete from enrollments where user_id = ?")
        .run(target);
      connection.sqlite
        .prepare("delete from user_academic_memberships where user_id = ?")
        .run(target);
      recordAuditEvent(
        {
          actorUserId,
          action: "academic_membership.clear",
          targetType: "user",
          targetId: String(target),
          summary: "academic membership and enrollments cleared",
        },
        connection,
      );
    })
    .immediate();
}
