import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  assertCanManageCohort,
  assertCanManageProgram,
  canAccessAcademicAdministration,
  getAcademicAuthority,
  listManageableUserIds,
  resolveAcademicAdminContext,
  updateFunctionalAuthority,
} from "@/lib/academic-authority";
import {
  createCohort,
  setAcademicMembership,
  updateCohort,
} from "@/lib/academic-membership";
import { createProgram } from "@/lib/academic";
import { canAccessAdministration } from "@/lib/access-policy";
import type { DatabaseConnection } from "@/lib/db/client";
import { createMigratedTestDatabase } from "@/lib/test-database";

function createUser(
  connection: DatabaseConnection,
  login: string,
  role: "admin" | "member" = "member",
): number {
  const now = Date.now();
  return Number(
    connection.sqlite
      .prepare(
        `insert into users
         (display_name, login, password_hash, role, active,
          password_changed_at, created_at, updated_at)
         values (?, ?, 'hash', ?, 1, ?, ?, ?)`,
      )
      .run(login, login, role, now, now, now).lastInsertRowid,
  );
}

describe("autoridade acadêmica segmentada", () => {
  let connection: DatabaseConnection;
  let adminId: number;
  let firstProgramId: number;
  let secondProgramId: number;
  let firstCohortId: number;
  let neighboringCohortId: number;

  beforeEach(() => {
    connection = createMigratedTestDatabase();
    adminId = createUser(connection, "admin", "admin");
    firstProgramId = createProgram({ name: "Programa A" }, connection).id;
    secondProgramId = createProgram({ name: "Programa B" }, connection).id;
    firstCohortId = createCohort(
      adminId,
      { programId: firstProgramId, name: "Turma A1" },
      connection,
    );
    neighboringCohortId = createCohort(
      adminId,
      { programId: firstProgramId, name: "Turma A2" },
      connection,
    );
  });

  afterEach(() => connection.close());

  it("mantém admin global e aceita múltiplos administradores", () => {
    expect(() =>
      updateFunctionalAuthority(
        adminId,
        adminId,
        "moderator",
        [firstProgramId],
        connection,
      ),
    ).toThrow("last active administrator");
    const secondAdminId = createUser(connection, "second-admin");
    updateFunctionalAuthority(adminId, secondAdminId, "admin", [], connection);

    expect(getAcademicAuthority(adminId, connection)).toMatchObject({
      role: "admin",
      programIds: [firstProgramId, secondProgramId],
      cohortIds: [firstCohortId, neighboringCohortId],
    });
    expect(getAcademicAuthority(secondAdminId, connection).role).toBe("admin");

    updateFunctionalAuthority(
      secondAdminId,
      adminId,
      "moderator",
      [firstProgramId],
      connection,
    );
    expect(getAcademicAuthority(adminId, connection).role).toBe("moderator");
  });

  it("limita moderator aos Programs persistidos e aceita múltiplos scopes", () => {
    const moderatorId = createUser(connection, "moderator");
    updateFunctionalAuthority(
      adminId,
      moderatorId,
      "moderator",
      [firstProgramId, secondProgramId],
      connection,
    );

    expect(getAcademicAuthority(moderatorId, connection)).toEqual({
      role: "moderator",
      programIds: [firstProgramId, secondProgramId],
      cohortIds: [],
    });
    expect(() =>
      assertCanManageProgram(moderatorId, firstProgramId, connection),
    ).not.toThrow();
    expect(() =>
      createCohort(
        moderatorId,
        { programId: firstProgramId, name: "Turma moderada" },
        connection,
      ),
    ).not.toThrow();

    updateFunctionalAuthority(
      adminId,
      moderatorId,
      "moderator",
      [firstProgramId],
      connection,
    );
    expect(() =>
      assertCanManageProgram(moderatorId, secondProgramId, connection),
    ).toThrow("Forbidden");
    expect(() =>
      createCohort(
        moderatorId,
        { programId: secondProgramId, name: "Turma negada" },
        connection,
      ),
    ).toThrow("Forbidden");
    expect(
      canAccessAdministration({
        id: moderatorId,
        displayName: "Moderator",
        login: "moderator",
        role: "member",
      }),
    ).toBe(false);
    expect(() =>
      updateFunctionalAuthority(moderatorId, adminId, "user", [], connection),
    ).toThrow("Forbidden");
  });

  it("limita curator às Cohorts persistidas e nega nível Program", () => {
    const curatorId = createUser(connection, "curator");
    updateFunctionalAuthority(
      adminId,
      curatorId,
      "curator",
      [firstCohortId],
      connection,
    );

    expect(() =>
      assertCanManageCohort(curatorId, firstCohortId, connection),
    ).not.toThrow();
    expect(() =>
      updateCohort(
        curatorId,
        firstCohortId,
        { programId: firstProgramId, name: "Turma A1 atualizada" },
        connection,
      ),
    ).not.toThrow();
    expect(() =>
      assertCanManageCohort(curatorId, neighboringCohortId, connection),
    ).toThrow("Forbidden");
    expect(() =>
      updateCohort(
        curatorId,
        neighboringCohortId,
        { programId: firstProgramId, name: "Turma vizinha" },
        connection,
      ),
    ).toThrow("Forbidden");
    expect(() =>
      assertCanManageProgram(curatorId, firstProgramId, connection),
    ).toThrow("Forbidden");
    expect(() =>
      updateFunctionalAuthority(curatorId, curatorId, "admin", [], connection),
    ).toThrow("Forbidden");
  });

  it("aceita múltiplas Cohorts para curator e restringe o seletor", () => {
    const curatorId = createUser(connection, "multi-curator");
    updateFunctionalAuthority(
      adminId,
      curatorId,
      "curator",
      [firstCohortId, neighboringCohortId],
      connection,
    );

    expect(getAcademicAuthority(curatorId, connection).cohortIds).toEqual([
      firstCohortId,
      neighboringCohortId,
    ]);
    expect(
      resolveAcademicAdminContext(
        curatorId,
        firstProgramId,
        neighboringCohortId,
        connection,
      ).selectedCohortId,
    ).toBe(neighboringCohortId);
    expect(() =>
      resolveAcademicAdminContext(curatorId, secondProgramId, null, connection),
    ).toThrow("Forbidden");
  });

  it("mantém USER sem administração e separa membership de authority", () => {
    const learnerId = createUser(connection, "learner");
    setAcademicMembership(
      adminId,
      learnerId,
      firstProgramId,
      firstCohortId,
      connection,
    );

    expect(getAcademicAuthority(learnerId, connection).role).toBe("user");
    expect(canAccessAcademicAdministration(learnerId, connection)).toBe(false);

    const moderatorId = createUser(connection, "separate-moderator");
    setAcademicMembership(
      adminId,
      moderatorId,
      secondProgramId,
      null,
      connection,
    );
    updateFunctionalAuthority(
      adminId,
      moderatorId,
      "moderator",
      [firstProgramId],
      connection,
    );

    expect(getAcademicAuthority(moderatorId, connection).programIds).toEqual([
      firstProgramId,
    ]);
    expect(listManageableUserIds(moderatorId, connection)).toContain(learnerId);
    expect(
      connection.sqlite
        .prepare(
          `select program_id as programId from user_academic_memberships
           where user_id = ?`,
        )
        .get(moderatorId),
    ).toEqual({ programId: secondProgramId });
  });
});
