import { describe, it, expect } from "vitest";
import { createMigratedTestDatabase } from "../test-database";
import { openV2Database, migrateV2 } from "./database";
import { seedV2Fake } from "./fixtures";
import { synchronizeAcademicProjection } from "./academic-projection";
import { withdrawEnrollment, enrollV2 } from "./users";
import { adminActor } from "./actor";
import { previewV1Import } from "./importer";
import { applyAcademicImport } from "./academic-import";
import { createAcademicPeriod } from "./academics";
function fixture() {
  const db = openV2Database(":memory:");
  migrateV2(db);
  seedV2Fake(db);
  const legacy = createMigratedTestDatabase();
  legacy.sqlite
    .prepare(
      "INSERT INTO users(id,display_name,login,password_hash,role) VALUES(99,'A','a.fake','fake','member'),(100,'B','b.fake','fake','member')",
    )
    .run();
  db.prepare(
    "INSERT INTO legacy_user_links(user_id,legacy_user_id) VALUES(3,99),(4,100)",
  ).run();
  return {
    db,
    legacy,
    close: () => {
      db.close();
      legacy.close();
    },
  };
}
describe("V3 academic projection", () => {
  it("upgrades confirmed offerings sharing old subject metadata without moving their contents", () => {
    const f = fixture();
    try {
      synchronizeAcademicProjection(f.db, f.legacy);
      const rows = f.db
        .prepare(
          "SELECT l.offering_id canonicalId,l.legacy_offering_id legacyId,o.subject_id subjectId FROM legacy_offering_links l JOIN offerings o ON o.id=l.offering_id ORDER BY o.id",
        )
        .all() as Array<{
        canonicalId: number;
        legacyId: number;
        subjectId: number;
      }>;
      const first = rows[0];
      const second = rows.find((r) => r.subjectId !== first.subjectId)!;
      const subject = f.legacy.sqlite
        .prepare("SELECT subject_id id FROM subject_offerings WHERE id=?")
        .get(first.legacyId) as { id: number };
      f.legacy.sqlite
        .prepare("UPDATE subject_offerings SET subject_id=? WHERE id=?")
        .run(subject.id, second.legacyId);
      f.legacy.sqlite
        .prepare(
          "INSERT INTO notes(owner_user_id,offering_id,title,content) VALUES(99,?,'Keep note','Original content')",
        )
        .run(second.legacyId);
      f.db.prepare("DELETE FROM academic_legacy_ids").run();
      expect(synchronizeAcademicProjection(f.db, f.legacy, true)).toBe(true);
      const subjects = f.legacy.sqlite
        .prepare(
          "SELECT subject_id id FROM subject_offerings WHERE id IN (?,?) ORDER BY id",
        )
        .all(first.legacyId, second.legacyId) as Array<{ id: number }>;
      expect(new Set(subjects.map((s) => s.id)).size).toBe(2);
      expect(
        f.db
          .prepare(
            "SELECT offering_id canonicalId,legacy_offering_id legacyId FROM legacy_offering_links ORDER BY offering_id",
          )
          .all(),
      ).toEqual(
        rows
          .map(({ canonicalId, legacyId }) => ({ canonicalId, legacyId }))
          .sort((a, b) => a.canonicalId - b.canonicalId),
      );
      expect(
        f.legacy.sqlite
          .prepare("SELECT offering_id,title,content FROM notes")
          .all(),
      ).toEqual([
        {
          offering_id: second.legacyId,
          title: "Keep note",
          content: "Original content",
        },
      ]);
      const stable = f.db
        .prepare(
          "SELECT * FROM academic_legacy_ids ORDER BY entity,canonical_id",
        )
        .all();
      synchronizeAcademicProjection(f.db, f.legacy, true);
      expect(
        f.db
          .prepare(
            "SELECT * FROM academic_legacy_ids ORDER BY entity,canonical_id",
          )
          .all(),
      ).toEqual(stable);
      expect(f.legacy.sqlite.pragma("foreign_key_check")).toEqual([]);
    } finally {
      f.close();
    }
  });
  it("projects distinct IDs and enrollment, repeats safely, withdraws and restores without cross-user access", () => {
    const f = fixture();
    try {
      expect(synchronizeAcademicProjection(f.db, f.legacy)).toBe(true);
      const links = f.db.prepare("SELECT * FROM legacy_offering_links").all();
      expect(links).toHaveLength(4);
      const before = f.legacy.sqlite
        .prepare("SELECT * FROM enrollments ORDER BY user_id,offering_id")
        .all();
      expect(before.length).toBeGreaterThan(0);
      expect(synchronizeAcademicProjection(f.db, f.legacy)).toBe(false);
      const e = f.db
        .prepare(
          "SELECT id,offering_id FROM enrollments WHERE user_id=3 LIMIT 1",
        )
        .get() as { id: number; offering_id: number };
      withdrawEnrollment(f.db, adminActor(1), e.id);
      synchronizeAcademicProjection(f.db, f.legacy);
      const target = (
        f.db
          .prepare(
            "SELECT legacy_offering_id id FROM legacy_offering_links WHERE offering_id=?",
          )
          .get(e.offering_id) as { id: number }
      ).id;
      expect(
        f.legacy.sqlite
          .prepare(
            "SELECT 1 FROM enrollments WHERE user_id=99 AND offering_id=?",
          )
          .get(target),
      ).toBeUndefined();
      enrollV2(f.db, adminActor(1), 3, e.offering_id);
      synchronizeAcademicProjection(f.db, f.legacy);
      expect(
        f.legacy.sqlite
          .prepare(
            "SELECT 1 FROM enrollments WHERE user_id=99 AND offering_id=?",
          )
          .get(target),
      ).toBeDefined();
      expect(f.db.prepare("SELECT * FROM legacy_offering_links").all()).toEqual(
        links,
      );
      expect(f.db.pragma("foreign_key_check")).toEqual([]);
      expect(f.legacy.sqlite.pragma("foreign_key_check")).toEqual([]);
    } finally {
      f.close();
    }
  });
  it("rolls back failed projection and permits retry without orphan links", () => {
    const f = fixture();
    try {
      f.legacy.sqlite.exec(
        "CREATE TRIGGER fail_projection BEFORE INSERT ON subject_offerings BEGIN SELECT RAISE(ABORT,'fake failure'); END;",
      );
      expect(() => synchronizeAcademicProjection(f.db, f.legacy)).toThrow(
        "Os dados foram preservados",
      );
      expect(f.db.prepare("SELECT * FROM legacy_offering_links").all()).toEqual(
        [],
      );
      expect(f.legacy.sqlite.prepare("SELECT * FROM subjects").all()).toEqual(
        [],
      );
      f.legacy.sqlite.exec("DROP TRIGGER fail_projection");
      expect(synchronizeAcademicProjection(f.db, f.legacy)).toBe(true);
    } finally {
      f.close();
    }
  });
  it("projects personal coursework with due date and submission state and archives after withdrawal", () => {
    const f = fixture();
    try {
      f.db
        .prepare(
          "INSERT INTO user_classroom_mappings(user_id,offering_id,course_id,course_name,confirmed_at) VALUES(3,1,'fake-course','Fake',1)",
        )
        .run();
      f.db
        .prepare(
          "INSERT INTO classroom_feed_v2(user_id,offering_id,external_id,title,description,due_at,submission_state) VALUES(3,1,'0:task','Task','Description',1893456000000,'TURNED_IN')",
        )
        .run();
      synchronizeAcademicProjection(f.db, f.legacy);
      const rows = f.legacy.sqlite
        .prepare(
          "SELECT user_id,title,description,due_at,status FROM activities",
        )
        .all();
      expect(rows).toEqual([
        {
          user_id: 99,
          title: "Task",
          description: "Description",
          due_at: 1893456000000,
          status: "submitted",
        },
      ]);
      synchronizeAcademicProjection(f.db, f.legacy, true);
      expect(
        f.legacy.sqlite.prepare("SELECT * FROM activities").all(),
      ).toHaveLength(1);
      f.db
        .prepare(
          "UPDATE enrollments SET withdrawn_at=1 WHERE user_id=3 AND offering_id=1",
        )
        .run();
      synchronizeAcademicProjection(f.db, f.legacy);
      expect(
        (
          f.legacy.sqlite.prepare("SELECT status FROM activities").get() as {
            status: string;
          }
        ).status,
      ).toBe("archived");
    } finally {
      f.close();
    }
  });
  it("rejects impossible dates before writing", () => {
    const f = fixture();
    try {
      expect(() =>
        createAcademicPeriod(
          f.db,
          adminActor(1),
          1,
          "Invalid",
          "2030-02-30",
          "2030-03-31",
        ),
      ).toThrow("datas válidas");
    } finally {
      f.close();
    }
  });
  it("detects content changes after import preview, then imports and repeats safely", () => {
    const f = fixture();
    try {
      const preview = previewV1Import(f.legacy.sqlite, f.db);
      f.legacy.sqlite
        .prepare("UPDATE users SET display_name='Changed' WHERE id=99")
        .run();
      expect(() =>
        applyAcademicImport(f.legacy.sqlite, f.db, adminActor(1), {
          runId: preview.runId,
          institutionId: 1,
          reviewed: true,
        }),
      ).toThrow("origem mudou");
      const fresh = previewV1Import(f.legacy.sqlite, f.db);
      expect(
        applyAcademicImport(f.legacy.sqlite, f.db, adminActor(1), {
          runId: fresh.runId,
          institutionId: 1,
          reviewed: true,
        }),
      ).toEqual({ repeated: false });
      expect(
        applyAcademicImport(f.legacy.sqlite, f.db, adminActor(1), {
          runId: fresh.runId,
          institutionId: 1,
          reviewed: true,
        }),
      ).toEqual({ repeated: true });
    } finally {
      f.close();
    }
  });
});
it("imports populated paired academic data without promoting permissions or altering private notes", () => {
  const f = fixture();
  const target = openV2Database(":memory:");
  try {
    synchronizeAcademicProjection(f.db, f.legacy);
    const legacyOffering = (
      f.db
        .prepare(
          "SELECT legacy_offering_id id FROM legacy_offering_links WHERE offering_id=1",
        )
        .get() as { id: number }
    ).id;
    f.legacy.sqlite
      .prepare(
        "INSERT INTO notes(owner_user_id,offering_id,title,content) VALUES(99,?,'Private','Unchanged content')",
      )
      .run(legacyOffering);
    migrateV2(target);
    target
      .prepare(
        "INSERT INTO admin_accounts(id,login,display_name,password_hash) VALUES(1,'admin','Admin','fake')",
      )
      .run();
    target
      .prepare(
        "INSERT INTO institutions(id,name) VALUES(1,'Import destination')",
      )
      .run();
    const preview = previewV1Import(f.legacy.sqlite, target);
    applyAcademicImport(f.legacy.sqlite, target, adminActor(1), {
      runId: preview.runId,
      institutionId: 1,
      reviewed: true,
    });
    expect(target.prepare("SELECT * FROM offerings").all()).toHaveLength(4);
    expect(target.prepare("SELECT * FROM permission_grants").all()).toEqual([]);
    expect(target.prepare("SELECT * FROM admin_accounts").all()).toHaveLength(
      1,
    );
    expect(
      f.legacy.sqlite.prepare("SELECT title,content FROM notes").all(),
    ).toEqual([{ title: "Private", content: "Unchanged content" }]);
    synchronizeAcademicProjection(target, f.legacy);
    expect(
      f.legacy.sqlite.prepare("SELECT * FROM subject_offerings").all(),
    ).toHaveLength(4);
    expect(target.pragma("foreign_key_check")).toEqual([]);
  } finally {
    target.close();
    f.close();
  }
});
it("recovers durable projection identities when the canonical commit has not persisted", () => {
  const f = fixture();
  try {
    synchronizeAcademicProjection(f.db, f.legacy);
    const before = f.legacy.sqlite
      .prepare("SELECT id FROM subject_offerings ORDER BY id")
      .all();
    f.db.prepare("DELETE FROM academic_legacy_ids").run();
    f.db.prepare("DELETE FROM legacy_offering_links").run();
    synchronizeAcademicProjection(f.db, f.legacy);
    expect(
      f.legacy.sqlite
        .prepare("SELECT id FROM subject_offerings ORDER BY id")
        .all(),
    ).toEqual(before);
  } finally {
    f.close();
  }
});
it("resolves subject navigation by explicit offering link when numeric IDs differ", async () => {
  const { canonicalSubjectForLegacyOffering } =
    await import("./academic-links");
  const f = fixture();
  try {
    f.db
      .prepare(
        "INSERT INTO legacy_offering_links(offering_id,legacy_offering_id,linked_by_admin_id,linked_at) VALUES(1,777,1,1)",
      )
      .run();
    expect(canonicalSubjectForLegacyOffering(f.db, 99, 777)).toBe(1);
    expect(canonicalSubjectForLegacyOffering(f.db, 100, 777)).toBeNull();
    expect(canonicalSubjectForLegacyOffering(f.db, 99, 1)).toBeNull();
  } finally {
    f.close();
  }
});
it("keeps a personal profile name and locale after another academic synchronization", async () => {
  const { synchronizeNormalProfileIdentity } =
    await import("./identity-bridge");
  const f = fixture();
  try {
    f.legacy.sqlite
      .prepare("UPDATE users SET bio='Keep this bio',locale='en' WHERE id=99")
      .run();
    synchronizeNormalProfileIdentity(f.db, 99, "Renamed student", "en");
    synchronizeAcademicProjection(f.db, f.legacy);
    f.db
      .prepare(
        "UPDATE enrollments SET withdrawn_at=1 WHERE user_id=3 AND offering_id=1",
      )
      .run();
    synchronizeAcademicProjection(f.db, f.legacy);
    expect(
      f.legacy.sqlite
        .prepare("SELECT display_name,locale,bio FROM users WHERE id=99")
        .get(),
    ).toEqual({
      display_name: "Renamed student",
      locale: "en",
      bio: "Keep this bio",
    });
    expect(
      f.db.prepare("SELECT display_name,locale FROM users WHERE id=3").get(),
    ).toEqual({ display_name: "Renamed student", locale: "en" });
  } finally {
    f.close();
  }
});
it("adopts a V1 coursework only by its confirmed course and owner, and separates remapped courses", () => {
  const f = fixture();
  try {
    synchronizeAcademicProjection(f.db, f.legacy);
    const offering = (
      f.db
        .prepare(
          "SELECT legacy_offering_id id FROM legacy_offering_links WHERE offering_id=1",
        )
        .get() as { id: number }
    ).id;
    const original = Number(
      f.legacy.sqlite
        .prepare(
          "INSERT INTO activities(user_id,offering_id,title,origin,external_source,external_id) VALUES(99,?,'V1 task','external','classroom','course-a:task')",
        )
        .run(offering).lastInsertRowid,
    );
    f.db
      .prepare(
        "INSERT INTO user_classroom_mappings(user_id,offering_id,course_id,course_name,confirmed_at) VALUES(3,1,'course-a','A',1)",
      )
      .run();
    f.db
      .prepare(
        "INSERT INTO classroom_feed_v2(user_id,offering_id,external_id,title) VALUES(3,1,'0:task','A task')",
      )
      .run();
    synchronizeAcademicProjection(f.db, f.legacy);
    expect(f.legacy.sqlite.prepare("SELECT id FROM activities").all()).toEqual([
      { id: original },
    ]);
    f.db
      .prepare(
        "UPDATE user_classroom_mappings SET course_id='course-b' WHERE user_id=3 AND offering_id=1",
      )
      .run();
    f.db
      .prepare(
        "UPDATE classroom_feed_v2 SET title='B task' WHERE user_id=3 AND offering_id=1",
      )
      .run();
    synchronizeAcademicProjection(f.db, f.legacy);
    const activities = f.legacy.sqlite
      .prepare("SELECT id,title,status FROM activities ORDER BY id")
      .all();
    expect(activities).toHaveLength(2);
    expect(activities[0]).toEqual({
      id: original,
      title: "A task",
      status: "archived",
    });
    expect(activities[1]).toMatchObject({ title: "B task", status: "pending" });
  } finally {
    f.close();
  }
});
it("does not call a returned but ungraded submission completed", () => {
  const f = fixture();
  try {
    f.db
      .prepare(
        "INSERT INTO user_classroom_mappings(user_id,offering_id,course_id,course_name,confirmed_at) VALUES(3,1,'course','Course',1)",
      )
      .run();
    f.db
      .prepare(
        "INSERT INTO classroom_feed_v2(user_id,offering_id,external_id,title,submission_state,submission_graded) VALUES(3,1,'0:a','Ungraded','RETURNED',0),(3,1,'0:b','Graded','RETURNED',1)",
      )
      .run();
    synchronizeAcademicProjection(f.db, f.legacy);
    expect(
      f.legacy.sqlite
        .prepare("SELECT title,status FROM activities ORDER BY title")
        .all(),
    ).toEqual([
      { title: "Graded", status: "completed" },
      { title: "Ungraded", status: "pending" },
    ]);
  } finally {
    f.close();
  }
});
