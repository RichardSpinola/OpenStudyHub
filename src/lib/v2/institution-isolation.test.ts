import { afterEach, describe, expect, it } from "vitest";
import { openV2Database, migrateV2, type V2Database } from "./database";
import { seedV2Fake } from "./fixtures";
import { adminActor, userActor } from "./actor";
import { canManage } from "./access";
import { visiblePrograms, replaceSchedule } from "./control";
import {
  createInstitution,
  createProgram,
  createSubject,
  createInstructor,
  createLocation,
  createAcademicPeriod,
  createOffering,
  createCurriculum,
  createCurriculumSemester,
  createCurriculumMapping,
  addScheduleSlot,
} from "./academics";

let db: V2Database | undefined;
afterEach(() => {
  db?.close();
  db = undefined;
});

describe("V2 institution boundaries", () => {
  it("isolates catalogs, offerings, schedules and delegated managers", () => {
    db = openV2Database(":memory:");
    migrateV2(db);
    seedV2Fake(db);
    const admin = adminActor(1);
    const other = createInstitution(db, admin, "Instituto Fictício Boreal");
    const program = createProgram(db, admin, other, "BOREAL", "Curso Boreal");
    const subject = createSubject(db, admin, other, "Disciplina Boreal");
    const instructor = createInstructor(db, admin, other, "Professor Boreal");
    const location = createLocation(db, admin, other, "Sala Boreal");
    const period = createAcademicPeriod(
      db,
      admin,
      other,
      "2030.1",
      "2030-02-01",
      "2030-06-30",
    );
    const curriculum = createCurriculum(db, admin, program, "v1");
    const semester = createCurriculumSemester(db, admin, curriculum, 1);
    expect(() => createCurriculumMapping(db!, admin, semester, 1)).toThrow();
    const mapping = createCurriculumMapping(db, admin, semester, subject);
    const offering = createOffering(db, admin, {
      subjectId: subject,
      programId: program,
      periodId: period,
      instructorId: instructor,
      curriculumSubjectId: mapping,
    });
    expect(offering).toBeGreaterThan(0);
    expect(() =>
      createOffering(db!, admin, {
        subjectId: 1,
        programId: program,
        periodId: period,
      }),
    ).toThrow();
    expect(() =>
      createOffering(db!, admin, {
        subjectId: subject,
        programId: program,
        periodId: 1,
      }),
    ).toThrow();
    expect(() =>
      createOffering(db!, admin, {
        subjectId: subject,
        programId: program,
        periodId: period,
        instructorId: 1,
      }),
    ).toThrow();
    expect(() =>
      db!
        .prepare(
          "INSERT INTO offerings(subject_id,program_id,period_id) VALUES(1,?,?)",
        )
        .run(program, period),
    ).toThrow();
    expect(() =>
      db!
        .prepare("UPDATE offerings SET instructor_id=1 WHERE id=?")
        .run(offering),
    ).toThrow();
    expect(() =>
      db!
        .prepare(
          "INSERT INTO schedule_slots(offering_id,location_id,weekday,starts_at_minutes,ends_at_minutes) VALUES(?,1,1,480,540)",
        )
        .run(offering),
    ).toThrow();
    expect(() =>
      addScheduleSlot(db!, admin, offering, 1, 480, 540, 1),
    ).toThrow();
    expect(() =>
      replaceSchedule(db!, admin, offering, [
        { weekday: 1, start: 480, end: 540, locationId: 1 },
      ]),
    ).toThrow();
    addScheduleSlot(db, admin, offering, 1, 480, 540, location);
    expect(visiblePrograms(db, userActor(2)).map((x) => x.id)).toEqual([1]);
    expect(visiblePrograms(db, userActor(5)).map((x) => x.id)).toEqual([2]);
    expect(
      canManage(db, userActor(2), "manage_academics", {
        kind: "program",
        id: program,
      }),
    ).toBe(false);
    for (const table of [
      "subjects",
      "academic_periods",
      "instructors",
      "locations",
    ])
      expect(
        (
          db
            .prepare(`SELECT count(*) n FROM ${table} WHERE institution_id=?`)
            .get(other) as { n: number }
        ).n,
      ).toBe(1);
    expect(db.pragma("foreign_key_check")).toEqual([]);
  });
});
