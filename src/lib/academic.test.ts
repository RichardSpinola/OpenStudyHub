import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { createDatabase, type DatabaseConnection } from "@/lib/db/client";

import {
  createAcademicPeriod,
  createInstructor,
  createLocation,
  createProgram,
  createScheduleSlot,
  createSubject,
  createSubjectOffering,
  createTimelineEvent,
  deleteSubject,
  getSubject,
  listAgenda,
  listSubjectOfferings,
  listSubjectTimeline,
  timeToMinutes,
  updateSubject,
} from "./academic";

function applyMigration(connection: DatabaseConnection, filename: string) {
  const sql = readFileSync(resolve(process.cwd(), "drizzle", filename), "utf8");
  for (const statement of sql.split("--> statement-breakpoint")) {
    if (statement.trim()) connection.sqlite.exec(statement);
  }
}

function createAcademicFixture(connection: DatabaseConnection) {
  const program = createProgram(
    { code: "DEMO", name: "Programa Demonstrativo", shortName: "PD" },
    connection,
  );
  const instructor = createInstructor(
    {
      code: "INST-1",
      name: "Instrutora Exemplo",
      displayName: "Prof. Exemplo",
    },
    connection,
  );
  const subject = createSubject(
    {
      code: "SUB-101",
      name: "Fundamentos de Interfaces",
      shortName: "Interfaces",
    },
    connection,
  );
  const period = createAcademicPeriod(
    { label: "Termo Demo", startsOn: "2030-02-01", endsOn: "2030-06-30" },
    connection,
  );
  connection.sqlite
    .prepare(
      `insert into app_settings (key, value)
       values ('academic.current_period_id', ?)
       on conflict(key) do update set value = excluded.value`,
    )
    .run(String(period.id));
  const location = createLocation(
    {
      name: "Sala Demo",
      campus: "Campus Exemplo",
      building: "Bloco A",
      room: "101",
    },
    connection,
  );
  const offering = createSubjectOffering(
    {
      subjectId: subject.id,
      programId: program.id,
      academicPeriodId: period.id,
      instructorId: instructor.id,
      classGroup: "T1",
      curriculumTerm: "2",
      status: "active",
    },
    connection,
  );

  return { program, instructor, subject, period, location, offering };
}

describe("Academic Core", () => {
  let connection: DatabaseConnection;

  beforeEach(() => {
    connection = createDatabase(":memory:");
    applyMigration(connection, "0000_kind_cobalt_man.sql");
    applyMigration(connection, "0001_academic_core.sql");
  });

  afterEach(() => connection.close());

  it.each([
    ["07:00", 420],
    ["23:59", 1439],
  ])("converte o horário válido %s", (value, expected) => {
    expect(timeToMinutes(value)).toBe(expected);
  });

  it.each(["12:60", "24:00", "-1:00", "texto arbitrário"])(
    "recusa o horário inválido %s",
    (value) => {
      expect(() => timeToMinutes(value)).toThrow("Invalid time.");
    },
  );

  it("cria entidades normalizadas e consulta ofertas", () => {
    const fixture = createAcademicFixture(connection);

    expect(listSubjectOfferings(connection)).toEqual([
      expect.objectContaining({
        offeringId: fixture.offering.id,
        subjectName: "Fundamentos de Interfaces",
        programName: "Programa Demonstrativo",
        periodLabel: "Termo Demo",
        instructorName: "Prof. Exemplo",
        classGroup: "T1",
      }),
    ]);
  });

  it("suporta CRUD de disciplina sem depender de uma oferta", () => {
    const subject = createSubject(
      { code: "IND-1", name: "Disciplina Independente" },
      connection,
    );

    expect(getSubject(subject.id, connection)?.name).toBe(
      "Disciplina Independente",
    );
    updateSubject(
      subject.id,
      { code: "IND-2", name: "Disciplina Atualizada", active: true },
      connection,
    );
    expect(getSubject(subject.id, connection)?.code).toBe("IND-2");
    deleteSubject(subject.id, connection);
    expect(getSubject(subject.id, connection)).toBeNull();
  });

  it("ordena a agenda por dia e horário e preserva múltiplos blocos", () => {
    const { offering, location } = createAcademicFixture(connection);
    createScheduleSlot(
      {
        offeringId: offering.id,
        locationId: location.id,
        weekday: 2,
        startsAtMinutes: 505,
        endsAtMinutes: 580,
      },
      connection,
    );
    createScheduleSlot(
      {
        offeringId: offering.id,
        locationId: location.id,
        weekday: 3,
        startsAtMinutes: 420,
        endsAtMinutes: 495,
      },
      connection,
    );
    createScheduleSlot(
      {
        offeringId: offering.id,
        locationId: location.id,
        weekday: 2,
        startsAtMinutes: 420,
        endsAtMinutes: 495,
      },
      connection,
    );

    expect(
      listAgenda(connection).map(({ weekday, startsAtMinutes }) => [
        weekday,
        startsAtMinutes,
      ]),
    ).toEqual([
      [2, 420],
      [2, 505],
      [3, 420],
    ]);
  });

  it("mostra a agenda somente quando existe período atual configurado", () => {
    const { offering, location } = createAcademicFixture(connection);
    createScheduleSlot(
      {
        offeringId: offering.id,
        locationId: location.id,
        weekday: 2,
        startsAtMinutes: 480,
        endsAtMinutes: 540,
      },
      connection,
    );
    expect(listAgenda(connection)).toHaveLength(1);

    connection.sqlite
      .prepare(
        "delete from app_settings where key = 'academic.current_period_id'",
      )
      .run();
    expect(listAgenda(connection)).toEqual([]);
  });

  it("valida horários recorrentes antes de escrever", () => {
    const { offering } = createAcademicFixture(connection);

    expect(() =>
      createScheduleSlot(
        {
          offeringId: offering.id,
          weekday: 0,
          startsAtMinutes: 420,
          endsAtMinutes: 495,
        },
        connection,
      ),
    ).toThrow();
    expect(() =>
      createScheduleSlot(
        {
          offeringId: offering.id,
          weekday: 2,
          startsAtMinutes: 500,
          endsAtMinutes: 500,
        },
        connection,
      ),
    ).toThrow();
  });

  it("ordena cronologicamente a timeline", () => {
    const { offering, subject, location } = createAcademicFixture(connection);
    createTimelineEvent(
      {
        offeringId: offering.id,
        locationId: location.id,
        type: "material",
        title: "Material posterior",
        startsAt: new Date("2030-03-10T10:00:00.000Z"),
      },
      connection,
    );
    createTimelineEvent(
      {
        offeringId: offering.id,
        type: "class",
        title: "Aula inicial",
        startsAt: new Date("2030-03-03T10:00:00.000Z"),
        endsAt: new Date("2030-03-03T11:00:00.000Z"),
      },
      connection,
    );

    expect(
      listSubjectTimeline(subject.id, connection).map(({ title }) => title),
    ).toEqual(["Aula inicial", "Material posterior"]);
  });

  it("mantém integridade referencial e aplica deletes explícitos", () => {
    const { offering, subject, instructor, location } =
      createAcademicFixture(connection);
    const slot = createScheduleSlot(
      {
        offeringId: offering.id,
        locationId: location.id,
        weekday: 2,
        startsAtMinutes: 420,
        endsAtMinutes: 495,
      },
      connection,
    );
    const event = createTimelineEvent(
      {
        offeringId: offering.id,
        locationId: location.id,
        type: "class",
        title: "Aula",
        startsAt: new Date("2030-03-03T10:00:00.000Z"),
      },
      connection,
    );

    expect(() => deleteSubject(subject.id, connection)).toThrow();
    connection.sqlite
      .prepare("delete from instructors where id = ?")
      .run(instructor.id);
    expect(
      connection.sqlite
        .prepare(
          "select instructor_id as value from subject_offerings where id = ?",
        )
        .get(offering.id),
    ).toEqual({ value: null });

    connection.sqlite
      .prepare("delete from locations where id = ?")
      .run(location.id);
    expect(
      connection.sqlite
        .prepare("select location_id as value from schedule_slots where id = ?")
        .get(slot.id),
    ).toEqual({ value: null });
    expect(() =>
      connection.sqlite
        .prepare("delete from subject_offerings where id = ?")
        .run(offering.id),
    ).toThrow();

    connection.sqlite
      .prepare("delete from timeline_events where id = ?")
      .run(event.id);
    connection.sqlite
      .prepare("delete from subject_offerings where id = ?")
      .run(offering.id);
    expect(
      connection.sqlite
        .prepare("select count(*) as count from schedule_slots")
        .get(),
    ).toEqual({ count: 0 });
  });

  it("recusa relações para registros inexistentes", () => {
    expect(() =>
      createSubjectOffering(
        {
          subjectId: 999,
          programId: 999,
          academicPeriodId: 999,
          status: "active",
        },
        connection,
      ),
    ).toThrow();
  });

  it("retorna estados vazios sem erro", () => {
    expect(listSubjectOfferings(connection)).toEqual([]);
    expect(listAgenda(connection)).toEqual([]);
    expect(listSubjectTimeline(999, connection)).toEqual([]);
    expect(getSubject(999, connection)).toBeNull();
  });
});
