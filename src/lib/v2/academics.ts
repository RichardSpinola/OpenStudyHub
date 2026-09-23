import type { Actor } from "./actor";
import type { V2Database } from "./database";
import type { Capability, Scope } from "./access";
import { canManage, isAdmin } from "./access";
import { recordAdminAction } from "./audit";

export type AcademicEntity =
  | "institutions"
  | "programs"
  | "shifts"
  | "curricula"
  | "subjects"
  | "cohorts"
  | "academic_periods"
  | "instructors"
  | "locations"
  | "offerings"
  | "community_groups";
const entities: AcademicEntity[] = [
  "institutions",
  "programs",
  "shifts",
  "curricula",
  "subjects",
  "cohorts",
  "academic_periods",
  "instructors",
  "locations",
  "offerings",
  "community_groups",
];

export function createProgram(
  db: V2Database,
  actor: Actor,
  institutionId: number,
  code: string,
  name: string,
): number {
  return writeAcademic(
    db,
    actor,
    "manage_academics",
    { kind: "institution", id: institutionId },
    () =>
      Number(
        db
          .prepare(
            "INSERT INTO programs(institution_id,code,name) VALUES(?,?,?)",
          )
          .run(institutionId, code, name).lastInsertRowid,
      ),
    "program",
  );
}

export function createCohort(
  db: V2Database,
  actor: Actor,
  input: {
    programId: number;
    curriculumId: number;
    shiftId: number;
    code: string;
    name: string;
  },
): number {
  return writeAcademic(
    db,
    actor,
    "manage_cohort",
    { kind: "program", id: input.programId },
    () => {
      const expected = db
        .prepare(
          `SELECT 1 FROM curricula c JOIN programs p ON p.id=c.program_id JOIN shifts s ON s.id=? AND s.institution_id=p.institution_id WHERE c.id=? AND p.id=? AND c.archived_at IS NULL AND p.archived_at IS NULL AND s.archived_at IS NULL`,
        )
        .get(input.shiftId, input.curriculumId, input.programId);
      if (!expected) throw new Error("Cohort curriculum/shift mismatch");
      return Number(
        db
          .prepare(
            "INSERT INTO cohorts(program_id,curriculum_id,shift_id,code,name) VALUES(?,?,?,?,?)",
          )
          .run(
            input.programId,
            input.curriculumId,
            input.shiftId,
            input.code,
            input.name,
          ).lastInsertRowid,
      );
    },
    "cohort",
  );
}

export function createCurriculumMapping(
  db: V2Database,
  actor: Actor,
  semesterId: number,
  subjectId: number,
): number {
  const row = db
    .prepare(
      "SELECT c.program_id id FROM curriculum_semesters cs JOIN curricula c ON c.id=cs.curriculum_id WHERE cs.id=?",
    )
    .get(semesterId) as { id: number } | undefined;
  if (!row) throw new Error("Semester missing");
  const institutionMatch = db
    .prepare(
      "SELECT 1 FROM subjects s JOIN programs p ON p.institution_id=s.institution_id WHERE s.id=? AND p.id=? AND s.archived_at IS NULL",
    )
    .get(subjectId, row.id);
  if (!institutionMatch)
    throw new Error("Curriculum subject/institution mismatch");
  return writeAcademic(
    db,
    actor,
    "manage_academics",
    { kind: "program", id: row.id },
    () =>
      Number(
        db
          .prepare(
            "INSERT INTO curriculum_subjects(semester_id,subject_id) VALUES(?,?)",
          )
          .run(semesterId, subjectId).lastInsertRowid,
      ),
    "curriculum_subject",
  );
}

export function createOffering(
  db: V2Database,
  actor: Actor,
  input: {
    subjectId: number;
    programId: number;
    periodId: number;
    shiftId?: number;
    instructorId?: number;
    curriculumSubjectId?: number;
    classGroup?: string;
  },
): number {
  return writeAcademic(
    db,
    actor,
    "manage_academics",
    { kind: "program", id: input.programId },
    () => {
      if (input.curriculumSubjectId) {
        const match = db
          .prepare(
            `SELECT 1 FROM curriculum_subjects m JOIN curriculum_semesters s ON s.id=m.semester_id JOIN curricula c ON c.id=s.curriculum_id WHERE m.id=? AND m.subject_id=? AND c.program_id=? AND c.archived_at IS NULL`,
          )
          .get(input.curriculumSubjectId, input.subjectId, input.programId);
        if (!match) throw new Error("Offering curriculum mismatch");
      }
      if (input.shiftId) {
        const match = db
          .prepare(
            "SELECT 1 FROM shifts s JOIN programs p ON p.institution_id=s.institution_id WHERE s.id=? AND p.id=?",
          )
          .get(input.shiftId, input.programId);
        if (!match) throw new Error("Offering shift mismatch");
      }
      const active = db
        .prepare(
          "SELECT 1 FROM subjects s JOIN programs p ON p.id=? AND p.institution_id=s.institution_id JOIN academic_periods ap ON ap.id=? AND ap.institution_id=p.institution_id LEFT JOIN instructors i ON i.id=? WHERE s.id=? AND s.archived_at IS NULL AND p.archived_at IS NULL AND ap.archived_at IS NULL AND (? IS NULL OR (i.institution_id=p.institution_id AND i.archived_at IS NULL))",
        )
        .get(
          input.programId,
          input.periodId,
          input.instructorId ?? null,
          input.subjectId,
          input.instructorId ?? null,
        );
      if (!active) throw new Error("Offering references archived entity");
      return Number(
        db
          .prepare(
            `INSERT INTO offerings(subject_id,program_id,period_id,shift_id,instructor_id,curriculum_subject_id,class_group) VALUES(?,?,?,?,?,?,?)`,
          )
          .run(
            input.subjectId,
            input.programId,
            input.periodId,
            input.shiftId ?? null,
            input.instructorId ?? null,
            input.curriculumSubjectId ?? null,
            input.classGroup ?? null,
          ).lastInsertRowid,
      );
    },
    "offering",
  );
}

export function addOfferingCohort(
  db: V2Database,
  actor: Actor,
  offeringId: number,
  cohortId: number,
): void {
  const match = db
    .prepare(
      "SELECT 1 FROM offerings o JOIN cohorts c ON c.program_id=o.program_id WHERE o.id=? AND c.id=? AND (o.shift_id IS NULL OR o.shift_id=c.shift_id)",
    )
    .get(offeringId, cohortId);
  if (!match) throw new Error("Offering/cohort program mismatch");
  writeAcademic(
    db,
    actor,
    "manage_cohort",
    { kind: "cohort", id: cohortId },
    () => {
      db.prepare(
        "INSERT INTO offering_cohorts(offering_id,cohort_id) VALUES(?,?)",
      ).run(offeringId, cohortId);
      return offeringId;
    },
    "offering_cohort",
  );
}

export function createCohortPeriod(
  db: V2Database,
  actor: Actor,
  cohortId: number,
  periodId: number,
  semesterId: number,
): number {
  return writeAcademic(
    db,
    actor,
    "manage_cohort",
    { kind: "cohort", id: cohortId },
    () => {
      const match = db
        .prepare(
          "SELECT 1 FROM cohorts c JOIN programs p ON p.id=c.program_id JOIN curriculum_semesters s ON s.curriculum_id=c.curriculum_id JOIN academic_periods ap ON ap.id=? AND ap.institution_id=p.institution_id WHERE c.id=? AND s.id=? AND c.archived_at IS NULL",
        )
        .get(periodId, cohortId, semesterId);
      if (!match) throw new Error("Cohort/semester mismatch");
      return Number(
        db
          .prepare(
            "INSERT INTO cohort_periods(cohort_id,period_id,semester_id,state) VALUES(?,?,?,'planned')",
          )
          .run(cohortId, periodId, semesterId).lastInsertRowid,
      );
    },
    "cohort_period",
  );
}

export function enroll(
  db: V2Database,
  actor: Actor,
  userId: number,
  offeringId: number,
  source: "cohort" | "exception",
  cohortId?: number,
): number {
  const row = db
    .prepare(
      "SELECT program_id id FROM offerings WHERE id=? AND archived_at IS NULL",
    )
    .get(offeringId) as { id: number } | undefined;
  if (!row) throw new Error("Offering unavailable");
  return writeAcademic(
    db,
    actor,
    "manage_enrollments",
    { kind: "program", id: row.id },
    () => {
      if (
        source === "cohort" &&
        (!cohortId ||
          !db
            .prepare(
              "SELECT 1 FROM offering_cohorts WHERE offering_id=? AND cohort_id=?",
            )
            .get(offeringId, cohortId))
      )
        throw new Error("Cohort assignment missing");
      return Number(
        db
          .prepare(
            "INSERT INTO enrollments(user_id,offering_id,source) VALUES(?,?,?)",
          )
          .run(userId, offeringId, source).lastInsertRowid,
      );
    },
    "enrollment",
  );
}

export function addScheduleSlot(
  db: V2Database,
  actor: Actor,
  offeringId: number,
  weekday: number,
  start: number,
  end: number,
  locationId: number | null,
): number {
  return writeAcademic(
    db,
    actor,
    "manage_schedule",
    { kind: "offering", id: offeringId },
    () => {
      if (
        locationId !== null &&
        !db
          .prepare(
            "SELECT 1 FROM offerings o JOIN programs p ON p.id=o.program_id JOIN locations l ON l.institution_id=p.institution_id WHERE o.id=? AND l.id=? AND l.archived_at IS NULL",
          )
          .get(offeringId, locationId)
      )
        throw new Error("Schedule location/institution mismatch");
      return Number(
        db
          .prepare(
            "INSERT INTO schedule_slots(offering_id,weekday,starts_at_minutes,ends_at_minutes,location_id) VALUES(?,?,?,?,?)",
          )
          .run(offeringId, weekday, start, end, locationId).lastInsertRowid,
      );
    },
    "schedule_slot",
  );
}

export function archiveAcademic(
  db: V2Database,
  actor: Actor,
  entity: AcademicEntity,
  id: number,
): void {
  if (!entities.includes(entity)) throw new Error("Unsupported archive entity");
  const scope: Scope =
    entity === "institutions"
      ? { kind: "institution", id }
      : entity === "programs"
        ? { kind: "program", id }
        : entity === "cohorts"
          ? { kind: "cohort", id }
          : entity === "offerings"
            ? { kind: "offering", id }
            : entity === "community_groups"
              ? { kind: "group", id }
              : { kind: "institution", id: institutionOf(db, entity, id) };
  if (!canManage(db, actor, "manage_academics", scope))
    throw new Error("Forbidden");
  mutateEntity(db, actor, entity, id, "archive");
}

// Restrictive FKs keep historical records; only genuinely unreferenced rows can be deleted.
export function deleteUnusedAcademic(
  db: V2Database,
  actor: Actor,
  entity: AcademicEntity,
  id: number,
): void {
  if (!entities.includes(entity)) throw new Error("Unsupported delete entity");
  const scope: Scope =
    entity === "institutions"
      ? { kind: "institution", id }
      : entity === "programs"
        ? { kind: "program", id }
        : entity === "cohorts"
          ? { kind: "cohort", id }
          : entity === "offerings"
            ? { kind: "offering", id }
            : entity === "community_groups"
              ? { kind: "group", id }
              : { kind: "institution", id: institutionOf(db, entity, id) };
  if (!canManage(db, actor, "manage_academics", scope))
    throw new Error("Forbidden");
  mutateEntity(db, actor, entity, id, "delete");
}

function institutionOf(
  db: V2Database,
  entity: AcademicEntity,
  id: number,
): number {
  if (entity === "shifts")
    return (
      db.prepare("SELECT institution_id id FROM shifts WHERE id=?").get(id) as {
        id: number;
      }
    ).id;
  if (entity === "curricula")
    return (
      db
        .prepare(
          "SELECT p.institution_id id FROM curricula c JOIN programs p ON p.id=c.program_id WHERE c.id=?",
        )
        .get(id) as { id: number }
    ).id;
  if (
    ["subjects", "academic_periods", "instructors", "locations"].includes(
      entity,
    )
  )
    return (
      db
        .prepare(`SELECT institution_id id FROM ${entity} WHERE id=?`)
        .get(id) as { id: number }
    ).id;
  throw new Error("Unknown entity");
}

function writeAcademic(
  db: V2Database,
  actor: Actor,
  capability: Capability,
  scope: Scope,
  write: () => number,
  targetType: string,
): number {
  if (!canManage(db, actor, capability, scope)) throw new Error("Forbidden");
  return db.transaction(() => {
    const id = write();
    recordAdminAction(
      db,
      actor,
      `academic.${targetType}.create`,
      targetType,
      id,
    );
    return id;
  })();
}

function mutateEntity(
  db: V2Database,
  actor: Actor,
  entity: AcademicEntity,
  id: number,
  operation: "archive" | "delete",
): void {
  db.transaction(() => {
    const result =
      operation === "archive"
        ? db
            .prepare(
              `UPDATE ${entity} SET archived_at=? WHERE id=? AND archived_at IS NULL`,
            )
            .run(Date.now(), id)
        : db.prepare(`DELETE FROM ${entity} WHERE id=?`).run(id);
    if (result.changes !== 1) throw new Error("Entity missing or unchanged");
    recordAdminAction(db, actor, `academic.${operation}`, entity, id);
  })();
}

export function createInstitution(
  db: V2Database,
  actor: Actor,
  name: string,
): number {
  if (!isAdmin(db, actor)) throw new Error("Admin required");
  return db.transaction(() => {
    const id = Number(
      db.prepare("INSERT INTO institutions(name) VALUES(?)").run(name)
        .lastInsertRowid,
    );
    recordAdminAction(
      db,
      actor,
      "academic.institution.create",
      "institution",
      id,
    );
    return id;
  })();
}

export function createShift(
  db: V2Database,
  actor: Actor,
  institutionId: number,
  code: string,
  name: string,
): number {
  return writeAcademic(
    db,
    actor,
    "manage_academics",
    { kind: "institution", id: institutionId },
    () =>
      Number(
        db
          .prepare("INSERT INTO shifts(institution_id,code,name) VALUES(?,?,?)")
          .run(institutionId, code, name).lastInsertRowid,
      ),
    "shift",
  );
}

export function createCurriculum(
  db: V2Database,
  actor: Actor,
  programId: number,
  version: string,
): number {
  return writeAcademic(
    db,
    actor,
    "manage_academics",
    { kind: "program", id: programId },
    () =>
      Number(
        db
          .prepare("INSERT INTO curricula(program_id,version) VALUES(?,?)")
          .run(programId, version).lastInsertRowid,
      ),
    "curriculum",
  );
}

export function createCurriculumSemester(
  db: V2Database,
  actor: Actor,
  curriculumId: number,
  ordinal: number,
): number {
  const row = db
    .prepare("SELECT program_id id FROM curricula WHERE id=?")
    .get(curriculumId) as { id: number } | undefined;
  if (!row) throw new Error("Curriculum missing");
  return writeAcademic(
    db,
    actor,
    "manage_academics",
    { kind: "program", id: row.id },
    () =>
      Number(
        db
          .prepare(
            "INSERT INTO curriculum_semesters(curriculum_id,ordinal) VALUES(?,?)",
          )
          .run(curriculumId, ordinal).lastInsertRowid,
      ),
    "curriculum_semester",
  );
}

export function createSubject(
  db: V2Database,
  actor: Actor,
  institutionId: number,
  name: string,
  code: string | null = null,
): number {
  return writeAcademic(
    db,
    actor,
    "manage_academics",
    { kind: "institution", id: institutionId },
    () =>
      Number(
        db
          .prepare(
            "INSERT INTO subjects(institution_id,name,code) VALUES(?,?,?)",
          )
          .run(institutionId, name, code).lastInsertRowid,
      ),
    "subject",
  );
}

export function createAcademicPeriod(
  db: V2Database,
  actor: Actor,
  institutionId: number,
  label: string,
  startsOn: string,
  endsOn: string,
): number {
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(startsOn) ||
    !/^\d{4}-\d{2}-\d{2}$/.test(endsOn) ||
    startsOn > endsOn ||
    !label.trim()
  )
    throw new Error("Invalid academic period");
  return writeAcademic(
    db,
    actor,
    "manage_academics",
    { kind: "institution", id: institutionId },
    () =>
      Number(
        db
          .prepare(
            "INSERT INTO academic_periods(institution_id,label,starts_on,ends_on) VALUES(?,?,?,?)",
          )
          .run(institutionId, label, startsOn, endsOn).lastInsertRowid,
      ),
    "academic_period",
  );
}

export function createInstructor(
  db: V2Database,
  actor: Actor,
  institutionId: number,
  name: string,
): number {
  return writeAcademic(
    db,
    actor,
    "manage_academics",
    { kind: "institution", id: institutionId },
    () =>
      Number(
        db
          .prepare("INSERT INTO instructors(institution_id,name) VALUES(?,?)")
          .run(institutionId, name).lastInsertRowid,
      ),
    "instructor",
  );
}

export function createLocation(
  db: V2Database,
  actor: Actor,
  institutionId: number,
  name: string,
  campus: string | null = null,
  room: string | null = null,
): number {
  return writeAcademic(
    db,
    actor,
    "manage_academics",
    { kind: "institution", id: institutionId },
    () =>
      Number(
        db
          .prepare(
            "INSERT INTO locations(institution_id,name,campus,room) VALUES(?,?,?,?)",
          )
          .run(institutionId, name, campus, room).lastInsertRowid,
      ),
    "location",
  );
}

export function renameAcademic(
  db: V2Database,
  actor: Actor,
  entity: AcademicEntity,
  id: number,
  name: string,
): void {
  const named: AcademicEntity[] = [
    "institutions",
    "programs",
    "shifts",
    "subjects",
    "cohorts",
    "instructors",
    "locations",
    "community_groups",
  ];
  if (!named.includes(entity) || !name.trim())
    throw new Error("Unsupported rename");
  if (entity === "institutions") {
    if (!isAdmin(db, actor)) throw new Error("Admin required");
  } else {
    const scope: Scope =
      entity === "programs"
        ? { kind: "program", id }
        : entity === "cohorts"
          ? { kind: "cohort", id }
          : entity === "community_groups"
            ? { kind: "group", id }
            : { kind: "institution", id: institutionOf(db, entity, id) };
    if (
      !canManage(
        db,
        actor,
        entity === "cohorts" ? "manage_cohort" : "manage_academics",
        scope,
      )
    )
      throw new Error("Forbidden");
  }
  db.transaction(() => {
    const result = db
      .prepare(`UPDATE ${entity} SET name=? WHERE id=? AND archived_at IS NULL`)
      .run(name.trim(), id);
    if (result.changes !== 1) throw new Error("Entity missing or archived");
    recordAdminAction(db, actor, "academic.rename", entity, id);
  })();
}
