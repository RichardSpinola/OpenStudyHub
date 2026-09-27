import { afterEach, describe, expect, it } from "vitest";
import { createMigratedTestDatabase } from "@/lib/test-database";
import { bootstrapV2 } from "./auth";
import { openV2Database, migrateV2 } from "./database";
import {
  getV2UserCurrentPeriod,
  getV2UserSubject,
  listV2UserAgenda,
  listV2UserOfferings,
  listV2UserSubjects,
} from "./academic-read";

const opened: Array<ReturnType<typeof openV2Database>> = [];
afterEach(() => {
  for (const db of opened) db.close();
  opened.length = 0;
});

describe("academic App reads on a fresh V2 instance", () => {
  it("lists and opens only the enrolled subject, with teacher, room and schedule, without a V1 offering", async () => {
    const legacy = createMigratedTestDatabase();
    const db = openV2Database(":memory:");
    opened.push(db);
    try {
      migrateV2(db);
      await bootstrapV2(db, {
        login: "gate.admin",
        name: "Gate Admin",
        password: "Ficticio-Somente-Gate-2026",
        institution: "Fixture Institute",
        program: "Systems",
        code: "SYS",
        shift: "Morning",
        cohort: "Cohort A",
        period: "2026.2",
        startsOn: "2026-08-01",
        endsOn: "2026-12-31",
        semesters: 1,
        subject: "Sample Subject",
        instructor: "Sample Teacher",
        location: "Sample Room",
      });
      db.prepare(
        "INSERT INTO users(id,login,display_name,password_hash) VALUES(1,'student.fake','Student','fake'),(2,'other.fake','Other','fake')",
      ).run();
      db.prepare(
        "UPDATE offerings SET instructor_id=1,class_group='A',state='active' WHERE id=1",
      ).run();
      db.prepare(
        "INSERT INTO enrollments(user_id,offering_id,source) VALUES(1,1,'exception')",
      ).run();
      db.prepare(
        "INSERT INTO schedule_slots(offering_id,location_id,weekday,starts_at_minutes,ends_at_minutes) VALUES(1,1,2,540,600)",
      ).run();
      const otherProgram = Number(
        db
          .prepare(
            "INSERT INTO programs(institution_id,code,name,short_name) VALUES(1,'OTHER','Other Course','OTHER')",
          )
          .run().lastInsertRowid,
      );
      const otherSubject = Number(
        db
          .prepare(
            "INSERT INTO subjects(institution_id,name) VALUES(1,'Other Subject')",
          )
          .run().lastInsertRowid,
      );
      db.prepare(
        "INSERT INTO offerings(subject_id,program_id,period_id,state) VALUES(?,?,1,'active')",
      ).run(otherSubject, otherProgram);

      expect(
        legacy.sqlite.prepare("SELECT count(*) n FROM subjects").get(),
      ).toEqual({ n: 0 });
      expect(
        legacy.sqlite.prepare("SELECT count(*) n FROM subject_offerings").get(),
      ).toEqual({ n: 0 });
      expect(
        legacy.sqlite.prepare("SELECT count(*) n FROM enrollments").get(),
      ).toEqual({ n: 0 });
      expect(listV2UserSubjects(db, 1)).toMatchObject([
        { id: 1, name: "Sample Subject" },
      ]);
      expect(getV2UserSubject(db, 1, 1)).toMatchObject({
        id: 1,
        name: "Sample Subject",
      });
      expect(listV2UserOfferings(db, 1)).toMatchObject([
        {
          offeringId: 1,
          subjectId: 1,
          instructorName: "Sample Teacher",
          classGroup: "A",
          periodLabel: "2026.2",
        },
      ]);
      expect(listV2UserAgenda(db, 1)).toMatchObject([
        {
          offeringId: 1,
          weekday: 2,
          startsAtMinutes: 540,
          locationName: "Sample Room",
        },
      ]);
      db.prepare("UPDATE offerings SET class_group=NULL WHERE id=1").run();
      expect(listV2UserOfferings(db, 1)[0].cohortName).toBeNull();
      db.prepare(
        "INSERT INTO user_academic_contexts(user_id,program_id,cohort_id,cohort_period_id,current) VALUES(1,1,1,1,1)",
      ).run();
      expect(listV2UserOfferings(db, 1)[0].cohortName).toBe("Cohort A");
      expect(getV2UserCurrentPeriod(db, 1, new Date(2026, 8, 1))?.label).toBe(
        "2026.2",
      );
      expect(listV2UserSubjects(db, 2)).toEqual([]);
      expect(getV2UserSubject(db, 2, 1)).toBeNull();
      expect(getV2UserSubject(db, 1, otherSubject)).toBeNull();
      expect(listV2UserOfferings(db, 1).map((item) => item.offeringId)).toEqual(
        [1],
      );
      expect(listV2UserOfferings(db, 2)).toEqual([]);
      expect(listV2UserAgenda(db, 2)).toEqual([]);
      db.prepare(
        "UPDATE enrollments SET withdrawn_at=? WHERE user_id=1 AND offering_id=1",
      ).run(Date.now());
      expect(getV2UserSubject(db, 1, 1)).toBeNull();
      expect(listV2UserAgenda(db, 1)).toEqual([]);
    } finally {
      legacy.close();
    }
  });
});
