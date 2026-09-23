import type { V2Database } from "./database";
import {
  createInstitution,
  createShift,
  createCurriculum,
  createCurriculumSemester,
  createSubject,
  createAcademicPeriod,
  createInstructor,
  createLocation,
  createProgram,
  createOffering,
  createCohort,
  createCohortPeriod,
  createCurriculumMapping,
  addOfferingCohort,
  addScheduleSlot,
  enroll,
} from "./academics";
import { grant } from "./access";
import { adminActor } from "./actor";

// Synthetic fixture only. Fixed IDs and data; never imports a real source.
export function seedV2Fake(
  db: V2Database,
  fakeHash = "FAKE_FIXTURE_NO_LOGIN",
): void {
  db.transaction(() => {
    const admin = adminActor(1);
    db.prepare(
      "INSERT INTO admin_accounts(id,login,display_name,password_hash) VALUES(1,'admin.fake','Admin Fictício',?)",
    ).run(fakeHash);
    const user = db.prepare(
      "INSERT INTO users(id,login,display_name,password_hash) VALUES(?,?,?,?)",
    );
    user.run(2, "manager.fake", "Gestor Fictício", fakeHash);
    user.run(3, "student.a.fake", "Estudante A", fakeHash);
    user.run(4, "student.b.fake", "Estudante B", fakeHash);
    user.run(5, "manager.b.fake", "Gestor B", fakeHash);
    createInstitution(db, admin, "Instituto Fictício Aurora");
    createProgram(db, admin, 1, "CURSO-A", "Curso Fictício A");
    createProgram(db, admin, 1, "CURSO-B", "Curso Fictício B");
    createShift(db, admin, 1, "morning", "Manhã");
    createShift(db, admin, 1, "evening", "Noite");
    createCurriculum(db, admin, 1, "demo-1");
    createCurriculum(db, admin, 2, "demo-1");
    createCurriculumSemester(db, admin, 1, 1);
    createCurriculumSemester(db, admin, 1, 2);
    createCurriculumSemester(db, admin, 2, 1);
    createSubject(db, admin, 1, "Fundamentos Fictícios", "A-101");
    createSubject(db, admin, 1, "Prática Fictícia", "A-202");
    createSubject(db, admin, 1, "Estudos de Exemplo", "B-101");
    createCurriculumMapping(db, admin, 1, 1);
    createCurriculumMapping(db, admin, 2, 2);
    createCurriculumMapping(db, admin, 3, 3);
    createCohort(db, admin, {
      programId: 1,
      curriculumId: 1,
      shiftId: 1,
      code: "A-M",
      name: "Turma A Manhã",
    });
    createCohort(db, admin, {
      programId: 1,
      curriculumId: 1,
      shiftId: 2,
      code: "A-N",
      name: "Turma A Noite",
    });
    createCohort(db, admin, {
      programId: 2,
      curriculumId: 2,
      shiftId: 1,
      code: "B-M",
      name: "Turma B Manhã",
    });
    createAcademicPeriod(db, admin, 1, "2030.1", "2030-02-01", "2030-06-30");
    createAcademicPeriod(db, admin, 1, "2030.2", "2030-08-01", "2030-12-15");
    createCohortPeriod(db, admin, 1, 1, 1);
    db.prepare(
      "UPDATE cohort_periods SET state='active',activated_at=? WHERE id=1",
    ).run(Date.UTC(2030, 1, 1));
    createCohortPeriod(db, admin, 1, 2, 2);
    createCohortPeriod(db, admin, 2, 1, 1);
    createCohortPeriod(db, admin, 3, 1, 3);
    db.prepare(
      "UPDATE cohort_periods SET state='active',activated_at=? WHERE id IN (3,4)",
    ).run(Date.UTC(2030, 1, 1));
    createInstructor(db, admin, 1, "Professor Exemplo A");
    createInstructor(db, admin, 1, "Professor Exemplo B");
    createLocation(db, admin, 1, "Sala Fictícia 1", "Campus Demo", "D-101");
    createLocation(db, admin, 1, "Sala Fictícia 2", "Campus Demo", "D-202");
    const a1 = createOffering(db, admin, {
      subjectId: 1,
      programId: 1,
      periodId: 1,
      shiftId: 1,
      instructorId: 1,
      curriculumSubjectId: 1,
      classGroup: "M",
    });
    const a2 = createOffering(db, admin, {
      subjectId: 1,
      programId: 1,
      periodId: 1,
      shiftId: 2,
      instructorId: 2,
      curriculumSubjectId: 1,
      classGroup: "N",
    });
    const a3 = createOffering(db, admin, {
      subjectId: 2,
      programId: 1,
      periodId: 2,
      shiftId: 1,
      instructorId: 2,
      curriculumSubjectId: 2,
      classGroup: "M",
    });
    const b1 = createOffering(db, admin, {
      subjectId: 3,
      programId: 2,
      periodId: 1,
      shiftId: 1,
      instructorId: 1,
      curriculumSubjectId: 3,
      classGroup: "M",
    });
    addOfferingCohort(db, admin, a1, 1);
    addOfferingCohort(db, admin, a2, 2);
    addOfferingCohort(db, admin, a3, 1);
    addOfferingCohort(db, admin, b1, 3);
    addScheduleSlot(db, admin, a1, 1, 480, 570, 1);
    addScheduleSlot(db, admin, a2, 2, 1080, 1170, 2);
    addScheduleSlot(db, admin, b1, 3, 600, 690, 1);
    db.prepare("UPDATE offerings SET state='active' WHERE id IN (1,2,4)").run();
    createAcademicPeriod(db, admin, 1, "2029.2", "2029-08-01", "2029-12-15");
    const past = createCohortPeriod(db, admin, 1, 3, 1);
    db.prepare(
      "UPDATE cohort_periods SET state='completed',completed_at=? WHERE id=?",
    ).run(Date.UTC(2029, 11, 15), past);
    grant(db, admin, 2, "manage_cohort", { kind: "program", id: 1 });
    grant(db, admin, 2, "manage_academics", { kind: "program", id: 1 });
    grant(db, admin, 2, "manage_schedule", { kind: "program", id: 1 });
    grant(db, admin, 2, "manage_enrollments", { kind: "cohort", id: 1 });
    grant(db, admin, 5, "manage_academics", { kind: "program", id: 2 });
    enroll(db, admin, 3, a1, "cohort", 1);
    enroll(db, admin, 4, a2, "exception"); // individual exception outside student's default cohort
    enroll(db, admin, 3, a3, "exception");
    db.prepare(
      "INSERT INTO user_academic_contexts(user_id,program_id,cohort_id,cohort_period_id,current) VALUES(3,1,1,1,1),(4,1,1,1,1)",
    ).run();
    db.prepare(
      "INSERT INTO storage_backends(id,kind,name,state) VALUES(1,'local','fake-local','ready')",
    ).run();
    db.prepare(
      "INSERT INTO storage_backends(kind,name,state) VALUES('local','Local','ready')",
    ).run();
    const fixed = Date.UTC(2030, 0, 1);
    for (const [table, column] of [
      ["users", "created_at"],
      ["admin_accounts", "created_at"],
      ["cohort_periods", "prepared_at"],
      ["enrollments", "created_at"],
      ["permission_grants", "created_at"],
      ["admin_audit_events", "occurred_at"],
    ] as const) {
      db.prepare(`UPDATE ${table} SET ${column}=?`).run(fixed);
    }
  })();
}
