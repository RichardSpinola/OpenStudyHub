import { z } from "zod";

import { assertActiveAdmin, updateUserRole } from "@/lib/access";
import { recordAuditEvent } from "@/lib/audit";
import type { DatabaseConnection } from "@/lib/db/client";
import { getDatabase } from "@/lib/db/client";

const idSchema = z.number().int().positive();
const idsSchema = z.array(idSchema).max(500);

export const functionalRoleSchema = z.enum([
  "admin",
  "moderator",
  "curator",
  "user",
]);

export type FunctionalRole = z.infer<typeof functionalRoleSchema>;

export type AcademicAuthority = {
  role: FunctionalRole;
  programIds: number[];
  cohortIds: number[];
};

export type AcademicScopeOption = {
  id: number;
  name: string;
  programId?: number;
};

export type ResolvedAcademicAdminContext = {
  authority: AcademicAuthority;
  programs: AcademicScopeOption[];
  cohorts: AcademicScopeOption[];
  selectedProgramId: number | null;
  selectedCohortId: number | null;
};

function uniqueIds(values: number[]): number[] {
  return [...new Set(idsSchema.parse(values))].sort(
    (left, right) => left - right,
  );
}

function getUserRole(
  userId: number,
  connection: DatabaseConnection,
  activeOnly: boolean,
): "admin" | "member" {
  const user = connection.sqlite
    .prepare(
      `select role from users where id = ?${activeOnly ? " and active = 1" : ""}`,
    )
    .get(idSchema.parse(userId)) as { role: "admin" | "member" } | undefined;
  if (!user) throw new Error("Forbidden.");
  return user.role;
}

function listModeratorProgramIds(
  userId: number,
  connection: DatabaseConnection,
): number[] {
  return (
    connection.sqlite
      .prepare(
        `select program_id as id from moderator_program_scopes
         where user_id = ? order by program_id`,
      )
      .all(userId) as Array<{ id: number }>
  ).map(({ id }) => id);
}

function listCuratorCohortIds(
  userId: number,
  connection: DatabaseConnection,
): number[] {
  return (
    connection.sqlite
      .prepare(
        `select cohort_id as id from curator_cohort_scopes
         where user_id = ? order by cohort_id`,
      )
      .all(userId) as Array<{ id: number }>
  ).map(({ id }) => id);
}

function readAcademicAuthority(
  userId: number,
  connection: DatabaseConnection,
  activeOnly: boolean,
): AcademicAuthority {
  const role = getUserRole(userId, connection, activeOnly);
  if (role === "admin") {
    const programIds = (
      connection.sqlite
        .prepare("select id from programs order by id")
        .all() as Array<{
        id: number;
      }>
    ).map(({ id }) => id);
    const cohortIds = (
      connection.sqlite
        .prepare("select id from cohorts order by id")
        .all() as Array<{
        id: number;
      }>
    ).map(({ id }) => id);
    return { role: "admin", programIds, cohortIds };
  }

  const programIds = listModeratorProgramIds(userId, connection);
  if (programIds.length > 0) {
    return { role: "moderator", programIds, cohortIds: [] };
  }

  const cohortIds = listCuratorCohortIds(userId, connection);
  if (cohortIds.length > 0) {
    const placeholders = cohortIds.map(() => "?").join(",");
    const scopedPrograms = connection.sqlite
      .prepare(
        `select distinct program_id as id from cohorts
         where id in (${placeholders}) order by program_id`,
      )
      .all(...cohortIds) as Array<{ id: number }>;
    return {
      role: "curator",
      programIds: scopedPrograms.map(({ id }) => id),
      cohortIds,
    };
  }

  return { role: "user", programIds: [], cohortIds: [] };
}

export function getAcademicAuthority(
  userId: number,
  connection: DatabaseConnection = getDatabase(),
): AcademicAuthority {
  return readAcademicAuthority(userId, connection, true);
}

export function getConfiguredAcademicAuthority(
  userId: number,
  connection: DatabaseConnection = getDatabase(),
): AcademicAuthority {
  return readAcademicAuthority(userId, connection, false);
}

export function assertAcademicAdministrator(
  userId: number,
  connection: DatabaseConnection = getDatabase(),
): AcademicAuthority {
  const authority = getAcademicAuthority(userId, connection);
  if (authority.role === "user") throw new Error("Forbidden.");
  return authority;
}

export function canAccessAcademicAdministration(
  userId: number,
  connection: DatabaseConnection = getDatabase(),
): boolean {
  try {
    return getAcademicAuthority(userId, connection).role !== "user";
  } catch {
    return false;
  }
}

function includes(values: number[], value: number): boolean {
  return values.includes(idSchema.parse(value));
}

export function assertCanManageProgram(
  actorUserId: number,
  programId: number,
  connection: DatabaseConnection = getDatabase(),
): void {
  const authority = assertAcademicAdministrator(actorUserId, connection);
  if (authority.role === "admin") return;
  if (
    authority.role === "moderator" &&
    includes(authority.programIds, programId)
  ) {
    return;
  }
  throw new Error("Forbidden.");
}

function getCohortProgramId(
  cohortId: number,
  connection: DatabaseConnection,
): number {
  const cohort = connection.sqlite
    .prepare("select program_id as programId from cohorts where id = ?")
    .get(idSchema.parse(cohortId)) as { programId: number } | undefined;
  if (!cohort) throw new Error("Cohort not found.");
  return cohort.programId;
}

export function assertCanManageCohort(
  actorUserId: number,
  cohortId: number,
  connection: DatabaseConnection = getDatabase(),
): void {
  const authority = assertAcademicAdministrator(actorUserId, connection);
  const id = idSchema.parse(cohortId);
  if (authority.role === "admin") return;
  if (
    authority.role === "moderator" &&
    includes(authority.programIds, getCohortProgramId(id, connection))
  ) {
    return;
  }
  if (authority.role === "curator" && includes(authority.cohortIds, id)) return;
  throw new Error("Forbidden.");
}

function getOfferingProgramId(
  offeringId: number,
  connection: DatabaseConnection,
): number {
  const offering = connection.sqlite
    .prepare(
      "select program_id as programId from subject_offerings where id = ?",
    )
    .get(idSchema.parse(offeringId)) as { programId: number } | undefined;
  if (!offering) throw new Error("Offering not found.");
  return offering.programId;
}

export function assertCanManageOffering(
  actorUserId: number,
  offeringId: number,
  connection: DatabaseConnection = getDatabase(),
): void {
  assertCanManageProgram(
    actorUserId,
    getOfferingProgramId(offeringId, connection),
    connection,
  );
}

export function assertCanManageScheduleSlot(
  actorUserId: number,
  scheduleSlotId: number,
  connection: DatabaseConnection = getDatabase(),
): void {
  const slot = connection.sqlite
    .prepare(
      "select offering_id as offeringId from schedule_slots where id = ?",
    )
    .get(idSchema.parse(scheduleSlotId)) as { offeringId: number } | undefined;
  if (!slot) throw new Error("Schedule slot not found.");
  assertCanManageOffering(actorUserId, slot.offeringId, connection);
}

type StoredMembership = {
  programId: number;
  cohortId: number | null;
};

function getStoredMembership(
  userId: number,
  connection: DatabaseConnection,
): StoredMembership | null {
  return (
    (connection.sqlite
      .prepare(
        `select program_id as programId, cohort_id as cohortId
         from user_academic_memberships where user_id = ?`,
      )
      .get(idSchema.parse(userId)) as StoredMembership | undefined) ?? null
  );
}

function assertCanManageExistingMembership(
  authority: AcademicAuthority,
  targetUserId: number,
  connection: DatabaseConnection,
): StoredMembership {
  const membership = getStoredMembership(targetUserId, connection);
  if (!membership) throw new Error("Forbidden.");
  if (
    authority.role === "moderator" &&
    includes(authority.programIds, membership.programId)
  ) {
    return membership;
  }
  if (
    authority.role === "curator" &&
    membership.cohortId !== null &&
    includes(authority.cohortIds, membership.cohortId)
  ) {
    return membership;
  }
  throw new Error("Forbidden.");
}

export function assertCanAssignAcademicMembership(
  actorUserId: number,
  targetUserId: number,
  programId: number,
  cohortId: number | null,
  connection: DatabaseConnection = getDatabase(),
): void {
  const authority = assertAcademicAdministrator(actorUserId, connection);
  if (authority.role === "admin") return;
  assertCanManageExistingMembership(authority, targetUserId, connection);
  if (
    authority.role === "moderator" &&
    includes(authority.programIds, programId)
  ) {
    return;
  }
  if (
    authority.role === "curator" &&
    cohortId !== null &&
    includes(authority.cohortIds, cohortId) &&
    getCohortProgramId(cohortId, connection) === programId
  ) {
    return;
  }
  throw new Error("Forbidden.");
}

export function assertCanClearAcademicMembership(
  actorUserId: number,
  targetUserId: number,
  connection: DatabaseConnection = getDatabase(),
): void {
  const authority = assertAcademicAdministrator(actorUserId, connection);
  if (authority.role === "admin") return;
  const membership = assertCanManageExistingMembership(
    authority,
    targetUserId,
    connection,
  );
  if (
    authority.role === "moderator" &&
    includes(authority.programIds, membership.programId)
  ) {
    return;
  }
  throw new Error("Forbidden.");
}

export function assertCanManageEnrollments(
  actorUserId: number,
  targetUserId: number,
  connection: DatabaseConnection = getDatabase(),
): void {
  const authority = assertAcademicAdministrator(actorUserId, connection);
  if (authority.role === "admin") return;
  if (authority.role !== "moderator") throw new Error("Forbidden.");
  assertCanManageExistingMembership(authority, targetUserId, connection);
}

function validateScopeIds(
  table: "programs" | "cohorts",
  ids: number[],
  connection: DatabaseConnection,
): void {
  if (ids.length === 0) return;
  const placeholders = ids.map(() => "?").join(",");
  const result = connection.sqlite
    .prepare(
      `select count(*) as count from ${table} where id in (${placeholders})`,
    )
    .get(...ids) as { count: number };
  if (result.count !== ids.length) throw new Error("Invalid authority scope.");
}

export function updateFunctionalAuthority(
  actorUserId: number,
  targetUserId: number,
  functionalRoleInput: FunctionalRole,
  scopeIdsInput: number[],
  connection: DatabaseConnection = getDatabase(),
): void {
  const functionalRole = functionalRoleSchema.parse(functionalRoleInput);
  const target = idSchema.parse(targetUserId);
  const scopeIds = uniqueIds(scopeIdsInput);
  assertActiveAdmin(actorUserId, connection);
  if (
    (functionalRole === "moderator" || functionalRole === "curator") &&
    scopeIds.length === 0
  ) {
    throw new Error("At least one authority scope is required.");
  }
  if (functionalRole === "moderator") {
    validateScopeIds("programs", scopeIds, connection);
  }
  if (functionalRole === "curator") {
    validateScopeIds("cohorts", scopeIds, connection);
  }

  connection.sqlite
    .transaction(() => {
      const targetUser = connection.sqlite
        .prepare("select role from users where id = ?")
        .get(target) as { role: "admin" | "member" } | undefined;
      if (!targetUser) throw new Error("User not found.");

      if (functionalRole === "admin") {
        updateUserRole(actorUserId, target, "admin", connection);
      } else if (targetUser.role !== "member") {
        updateUserRole(actorUserId, target, "member", connection);
      }

      connection.sqlite
        .prepare("delete from moderator_program_scopes where user_id = ?")
        .run(target);
      connection.sqlite
        .prepare("delete from curator_cohort_scopes where user_id = ?")
        .run(target);

      if (functionalRole === "moderator") {
        const insert = connection.sqlite.prepare(
          `insert into moderator_program_scopes (user_id, program_id)
         values (?, ?)`,
        );
        for (const programId of scopeIds) insert.run(target, programId);
      } else if (functionalRole === "curator") {
        const insert = connection.sqlite.prepare(
          `insert into curator_cohort_scopes (user_id, cohort_id)
         values (?, ?)`,
        );
        for (const cohortId of scopeIds) insert.run(target, cohortId);
      }

      recordAuditEvent(
        {
          actorUserId,
          action: "academic_authority.update",
          targetType: "user",
          targetId: String(target),
          summary: `${functionalRole}:${scopeIds.length}`,
        },
        connection,
      );
    })
    .immediate();
}

export function listManageableUserIds(
  actorUserId: number,
  connection: DatabaseConnection = getDatabase(),
): number[] {
  const authority = assertAcademicAdministrator(actorUserId, connection);
  if (authority.role === "admin") {
    return (
      connection.sqlite
        .prepare("select id from users order by id")
        .all() as Array<{
        id: number;
      }>
    ).map(({ id }) => id);
  }

  const scopeIds =
    authority.role === "moderator" ? authority.programIds : authority.cohortIds;
  const placeholders = scopeIds.map(() => "?").join(",");
  const column = authority.role === "moderator" ? "program_id" : "cohort_id";
  return (
    connection.sqlite
      .prepare(
        `select user_id as id from user_academic_memberships
         where ${column} in (${placeholders}) order by user_id`,
      )
      .all(...scopeIds) as Array<{ id: number }>
  ).map(({ id }) => id);
}

export function resolveAcademicAdminContext(
  actorUserId: number,
  requestedProgramId: number | null,
  requestedCohortId: number | null,
  connection: DatabaseConnection = getDatabase(),
): ResolvedAcademicAdminContext {
  const authority = assertAcademicAdministrator(actorUserId, connection);
  const allPrograms = connection.sqlite
    .prepare("select id, name from programs order by name collate nocase, id")
    .all() as AcademicScopeOption[];
  const allCohorts = connection.sqlite
    .prepare(
      `select id, name, program_id as programId from cohorts
       order by name collate nocase, id`,
    )
    .all() as AcademicScopeOption[];
  const programs = allPrograms.filter(({ id }) =>
    authority.programIds.includes(id),
  );
  const allowedCohorts = allCohorts.filter(({ id, programId }) =>
    authority.role === "curator"
      ? authority.cohortIds.includes(id)
      : authority.programIds.includes(programId ?? 0),
  );

  if (
    requestedProgramId !== null &&
    !programs.some(({ id }) => id === requestedProgramId)
  ) {
    throw new Error("Forbidden.");
  }
  const selectedProgramId = requestedProgramId ?? programs[0]?.id ?? null;
  const cohorts = allowedCohorts.filter(
    ({ programId }) => programId === selectedProgramId,
  );
  if (
    requestedCohortId !== null &&
    !cohorts.some(({ id }) => id === requestedCohortId)
  ) {
    throw new Error("Forbidden.");
  }

  return {
    authority,
    programs,
    cohorts,
    selectedProgramId,
    selectedCohortId: requestedCohortId,
  };
}
