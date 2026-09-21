import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  createAcademicPeriod,
  createProgram,
  createScheduleSlot,
  createSubject,
  createSubjectOffering,
  listUserAgenda,
  listUserSubjects,
} from "@/lib/academic";
import {
  createActivity,
  listUserActivities,
  setActivityStatus,
  updateActivity,
} from "@/lib/activities";
import type { DatabaseConnection } from "@/lib/db/client";
import {
  listUserEnrollmentIds,
  replaceUserEnrollments,
} from "@/lib/enrollments";
import { createMigratedTestDatabase } from "@/lib/test-database";
import { getTodayData } from "@/lib/today";
import {
  createCohort,
  clearAcademicMembership,
  getAcademicMembership,
  setAcademicMembership,
  updateCohort,
} from "@/lib/academic-membership";

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

function createOffering(connection: DatabaseConnection) {
  const program = createProgram({ name: "Programa" }, connection);
  const subject = createSubject(
    { code: "WEB", name: "Interfaces Web" },
    connection,
  );
  const period = createAcademicPeriod(
    { label: "2030.1", startsOn: "2030-01-01", endsOn: "2030-06-30" },
    connection,
  );
  connection.sqlite
    .prepare("insert into app_settings (key, value) values (?, ?)")
    .run("academic.current_period_id", String(period.id));
  const offering = createSubjectOffering(
    {
      subjectId: subject.id,
      programId: program.id,
      academicPeriodId: period.id,
      status: "active",
    },
    connection,
  );
  return { program, subject, period, offering };
}

describe("fluxo acadêmico pessoal", () => {
  let connection: DatabaseConnection;

  beforeEach(() => {
    connection = createMigratedTestDatabase();
  });

  afterEach(() => connection.close());

  it("permite somente ao administrador substituir matrículas", () => {
    const adminId = createUser(connection, "admin", "admin");
    const memberId = createUser(connection, "member");
    const otherId = createUser(connection, "other");
    const { program, offering } = createOffering(connection);
    setAcademicMembership(adminId, memberId, program.id, null, connection);

    expect(() =>
      replaceUserEnrollments(otherId, memberId, [offering.id], connection),
    ).toThrow("Forbidden");
    expect(
      replaceUserEnrollments(adminId, memberId, [offering.id], connection),
    ).toEqual([offering.id]);
    expect(listUserEnrollmentIds(memberId, connection)).toEqual([offering.id]);
    expect(listUserEnrollmentIds(otherId, connection)).toEqual([]);
  });

  it("filtra disciplinas e agenda pela matrícula do usuário", () => {
    const adminId = createUser(connection, "admin", "admin");
    const memberId = createUser(connection, "member");
    const otherId = createUser(connection, "other");
    const { program, subject, offering } = createOffering(connection);
    setAcademicMembership(adminId, memberId, program.id, null, connection);
    createScheduleSlot(
      {
        offeringId: offering.id,
        weekday: 2,
        startsAtMinutes: 480,
        endsAtMinutes: 540,
      },
      connection,
    );
    replaceUserEnrollments(adminId, memberId, [offering.id], connection);

    expect(listUserSubjects(memberId, connection).map(({ id }) => id)).toEqual([
      subject.id,
    ]);
    expect(listUserAgenda(memberId, connection)).toHaveLength(1);
    expect(listUserSubjects(otherId, connection)).toEqual([]);
    expect(listUserAgenda(otherId, connection)).toEqual([]);
  });

  it("isola criação, edição e status das atividades por proprietário", () => {
    const adminId = createUser(connection, "admin", "admin");
    const memberId = createUser(connection, "member");
    const otherId = createUser(connection, "other");
    const { program, offering } = createOffering(connection);
    setAcademicMembership(adminId, memberId, program.id, null, connection);
    setAcademicMembership(adminId, otherId, program.id, null, connection);
    replaceUserEnrollments(adminId, memberId, [offering.id], connection);
    replaceUserEnrollments(adminId, otherId, [offering.id], connection);

    const activityId = createActivity(
      memberId,
      {
        offeringId: offering.id,
        title: "Entrega local",
        dueAt: new Date("2030-03-08T12:00:00.000Z"),
      },
      connection,
    );
    expect(listUserActivities(otherId, connection)).toEqual([]);
    expect(() =>
      updateActivity(
        otherId,
        activityId,
        { offeringId: offering.id, title: "Invasão", status: "pending" },
        connection,
      ),
    ).toThrow("Activity not found");
    setActivityStatus(memberId, activityId, "in_progress", connection);
    expect(listUserActivities(memberId, connection)[0]).toMatchObject({
      title: "Entrega local",
      status: "in_progress",
      origin: "local",
    });
  });

  it("recusa atividade em oferta fora da matrícula", () => {
    const memberId = createUser(connection, "member");
    const { offering } = createOffering(connection);
    expect(() =>
      createActivity(
        memberId,
        { offeringId: offering.id, title: "Fora do contexto" },
        connection,
      ),
    ).toThrow("outside the user's academic context");
  });

  it("mantém campos sincronizados externamente somente leitura", () => {
    const adminId = createUser(connection, "admin", "admin");
    const memberId = createUser(connection, "member");
    const { program, offering } = createOffering(connection);
    setAcademicMembership(adminId, memberId, program.id, null, connection);
    replaceUserEnrollments(adminId, memberId, [offering.id], connection);
    const now = Date.now();
    const externalId = Number(
      connection.sqlite
        .prepare(
          `insert into activities
           (user_id, offering_id, title, status, origin,
            external_source, external_id, created_at, updated_at)
           values (?, ?, 'Classroom task', 'pending', 'external',
                   'classroom', 'course:work', ?, ?)`,
        )
        .run(memberId, offering.id, now, now).lastInsertRowid,
    );

    expect(() =>
      setActivityStatus(memberId, externalId, "completed", connection),
    ).toThrow("Activity not found");
    expect(() =>
      updateActivity(
        memberId,
        externalId,
        {
          offeringId: offering.id,
          title: "Local overwrite",
          status: "completed",
        },
        connection,
      ),
    ).toThrow("Activity not found");
    expect(listUserActivities(memberId, connection)[0]).toMatchObject({
      title: "Classroom task",
      status: "pending",
      origin: "external",
    });
  });

  it("recusa enrollment adulterado para oferta cancelada do mesmo programa", () => {
    const adminId = createUser(connection, "admin", "admin");
    const memberId = createUser(connection, "member");
    const { program, subject, period } = createOffering(connection);
    const cancelled = createSubjectOffering(
      {
        subjectId: subject.id,
        programId: program.id,
        academicPeriodId: period.id,
        status: "cancelled",
      },
      connection,
    );
    setAcademicMembership(adminId, memberId, program.id, null, connection);

    expect(() =>
      replaceUserEnrollments(adminId, memberId, [cancelled.id], connection),
    ).toThrow("outside the user's program");
  });

  it("agrega aulas do dia e atividades pendentes dos próximos sete dias", () => {
    const adminId = createUser(connection, "admin", "admin");
    const memberId = createUser(connection, "member");
    const { program, offering } = createOffering(connection);
    setAcademicMembership(adminId, memberId, program.id, null, connection);
    replaceUserEnrollments(adminId, memberId, [offering.id], connection);
    createScheduleSlot(
      {
        offeringId: offering.id,
        weekday: 2,
        startsAtMinutes: 480,
        endsAtMinutes: 540,
        validFrom: "2030-03-01",
        validUntil: "2030-03-31",
      },
      connection,
    );
    createActivity(
      memberId,
      {
        offeringId: offering.id,
        title: "Próxima entrega",
        dueAt: new Date("2030-03-08T12:00:00.000Z"),
      },
      connection,
    );

    const today = getTodayData(
      memberId,
      new Date(2030, 2, 5, 9, 0, 0),
      connection,
    );
    expect(today.classes).toHaveLength(1);
    expect(today.activities.map(({ title }) => title)).toEqual([
      "Próxima entrega",
    ]);
  });

  it("suporta programa com turma opcional e valida a relação entre ambos", () => {
    const adminId = createUser(connection, "admin", "admin");
    const firstId = createUser(connection, "first");
    const secondId = createUser(connection, "second");
    const { program } = createOffering(connection);
    const cohortId = createCohort(
      adminId,
      { programId: program.id, code: "T1", name: "Turma 1" },
      connection,
    );

    setAcademicMembership(adminId, firstId, program.id, cohortId, connection);
    setAcademicMembership(adminId, secondId, program.id, null, connection);

    expect(getAcademicMembership(firstId, connection)).toMatchObject({
      programId: program.id,
      cohortId,
      cohortName: "Turma 1",
    });
    expect(getAcademicMembership(secondId, connection)).toMatchObject({
      programId: program.id,
      cohortId: null,
    });
  });

  it("impede mover uma turma atribuída para outro programa", () => {
    const adminId = createUser(connection, "admin", "admin");
    const memberId = createUser(connection, "member");
    const { program } = createOffering(connection);
    const otherProgram = createProgram({ name: "Outro programa" }, connection);
    const cohortId = createCohort(
      adminId,
      { programId: program.id, name: "Turma atribuída" },
      connection,
    );
    setAcademicMembership(adminId, memberId, program.id, cohortId, connection);

    expect(() =>
      updateCohort(
        adminId,
        cohortId,
        { programId: otherProgram.id, name: "Turma atribuída" },
        connection,
      ),
    ).toThrow("cannot move");
  });

  it("audita criação e edição de turma e limpeza de membership", () => {
    const adminId = createUser(connection, "admin", "admin");
    const memberId = createUser(connection, "member");
    const { program } = createOffering(connection);
    const cohortId = createCohort(
      adminId,
      { programId: program.id, name: "Turma auditada" },
      connection,
    );
    updateCohort(
      adminId,
      cohortId,
      { programId: program.id, name: "Turma auditada 2" },
      connection,
    );
    setAcademicMembership(adminId, memberId, program.id, cohortId, connection);
    clearAcademicMembership(adminId, memberId, connection);

    const actions = (
      connection.sqlite
        .prepare(
          `select action from audit_events
           where action in (
             'academic.cohort_create',
             'academic.cohort_update',
             'academic_membership.clear'
           ) order by id`,
        )
        .all() as Array<{ action: string }>
    ).map(({ action }) => action);
    expect(actions).toEqual([
      "academic.cohort_create",
      "academic.cohort_update",
      "academic_membership.clear",
    ]);
  });
});
