import { createMigratedTestDatabase } from "../test-database";
import { describe, it, expect } from "vitest";
import { openV2Database, migrateV2 } from "./database";
import { seedV2Fake } from "./fixtures";
import { adminActor, userActor } from "./actor";
import {
  saveAcademicEvent,
  cancelAcademicEvent,
  userAcademicEvents,
  activeExam,
  examRestrictedPath,
} from "./academic-events";
import { grant, revokeGrant, canManage } from "./access";
import { mutateAcademic } from "./control";
import { previewAcademicRemoval } from "./academic-removal";
import { createProgram, createInstitution } from "./academics";
import { saveOfferingCover, removeOfferingCover } from "./offering-covers";
function fixture() {
  const db = openV2Database(":memory:");
  migrateV2(db);
  seedV2Fake(db);
  return db;
}
const now = Date.UTC(2030, 2, 10, 12),
  base = {
    institutionId: 1,
    programId: null,
    cohortId: null,
    offeringId: 1,
    kind: "event" as const,
    title: "Aula de revisão",
    description: "Orientação",
    startsAt: now,
    endsAt: now + 3600000,
  };
describe("V3 stage 3 authority and academic operations", () => {
  it("events are scoped to the enrolled user, editable, cancellable, and one-off classes require an offering", () => {
    const db = fixture();
    try {
      const id = saveAcademicEvent(db, adminActor(1), base);
      expect(userAcademicEvents(db, 3, now, now + 86400000)).toHaveLength(1);
      expect(userAcademicEvents(db, 4, now, now + 86400000)).toHaveLength(0);
      saveAcademicEvent(
        db,
        adminActor(1),
        { ...base, title: "Título corrigido" },
        id,
      );
      expect(userAcademicEvents(db, 3, now)[0].title).toBe("Título corrigido");
      cancelAcademicEvent(db, adminActor(1), id);
      expect(userAcademicEvents(db, 3, now)).toHaveLength(0);
      expect(() =>
        saveAcademicEvent(db, adminActor(1), {
          ...base,
          kind: "class",
          offeringId: null,
        }),
      ).toThrow("disciplina");
      expect(() =>
        saveAcademicEvent(db, adminActor(1), { ...base, endsAt: now - 1 }),
      ).toThrow("fim");
    } finally {
      db.close();
    }
  });
  it("cross-institution audience changes and ungranted managers are denied", () => {
    const db = fixture();
    try {
      const i = createInstitution(db, adminActor(1), "Outra");
      expect(() =>
        saveAcademicEvent(db, adminActor(1), { ...base, institutionId: i }),
      ).toThrow("instituição selecionada");
      expect(() => saveAcademicEvent(db, userActor(5), base)).toThrow(
        "permissão",
      );
      const g = grant(db, adminActor(1), 5, "manage_schedule", {
        kind: "offering",
        id: 1,
      });
      saveAcademicEvent(db, userActor(5), base);
      revokeGrant(db, adminActor(1), g);
      expect(() => saveAcademicEvent(db, userActor(5), base)).toThrow(
        "permissão",
      );
    } finally {
      db.close();
    }
  });
  it("exam starts and ends at exact boundaries, requires Admin, and cancellation immediately releases the user", () => {
    const db = fixture();
    try {
      const id = saveAcademicEvent(db, adminActor(1), {
        ...base,
        kind: "exam",
      });
      expect(activeExam(db, 3, now - 1)).toBeNull();
      expect(activeExam(db, 3, now)?.id).toBe(id);
      expect(activeExam(db, 4, now)).toBeNull();
      expect(activeExam(db, 3, now + 3600000)).toBeNull();
      expect(() =>
        saveAcademicEvent(db, userActor(2), { ...base, kind: "exam" }),
      ).toThrow("Admin");
      cancelAcademicEvent(db, adminActor(1), id);
      expect(activeExam(db, 3, now)).toBeNull();
    } finally {
      db.close();
    }
  });
  it("exam audience supports course/cohort and archived or inactive membership loses the restriction", () => {
    const db = fixture();
    try {
      saveAcademicEvent(db, adminActor(1), {
        ...base,
        offeringId: null,
        cohortId: 1,
        kind: "exam",
      });
      expect(activeExam(db, 4, now)).not.toBeNull();
      db.prepare("UPDATE users SET active=0 WHERE id=4").run();
      expect(activeExam(db, 4, now)).toBeNull();
      db.prepare("UPDATE programs SET archived_at=? WHERE id=1").run(now);
      expect(activeExam(db, 3, now)).toBeNull();
    } finally {
      db.close();
    }
  });
  it("blocks resource routes and APIs while preserving home, schedule, academic and shortcut routes", () => {
    for (const p of [
      "/notes",
      "/notes/3",
      "/documents",
      "/projects/new",
      "/library",
      "/chat",
      "/extras",
      "/api/chat/1",
      "/api/chat/1/attachments",
      "/api/chat-attachment/9",
      "/api/local-document/2",
      "/api/projects/2/versions/1/download",
      "/api/extras/whiteboard",
    ])
      expect(examRestrictedPath(p), p).toBe(true);
    for (const p of [
      "/",
      "/today",
      "/subjects",
      "/settings",
      "/api/home-search/suggestions",
      "/api/shortcut-icon/preview",
      "/control",
    ])
      expect(examRestrictedPath(p), p).toBe(false);
  });
  it("empty course can be removed, linked course reports dependencies and preserves history", () => {
    const db = fixture();
    try {
      const id = createProgram(
        db,
        adminActor(1),
        1,
        "EMPTY",
        "Curso vazio",
        "VAZ",
      );
      expect(
        previewAcademicRemoval(db, adminActor(1), "programs", id).canDelete,
      ).toBe(true);
      mutateAcademic(db, adminActor(1), "programs", id, "delete");
      expect(
        db.prepare("SELECT 1 FROM programs WHERE id=?").get(id),
      ).toBeUndefined();
      const n = (
        db.prepare("SELECT count(*) n FROM enrollments").get() as { n: number }
      ).n;
      expect(
        previewAcademicRemoval(db, adminActor(1), "programs", 1).dependencies
          .length,
      ).toBeGreaterThan(0);
      expect(() =>
        mutateAcademic(db, adminActor(1), "programs", 1, "delete"),
      ).toThrow("histórico");
      expect(
        (
          db.prepare("SELECT count(*) n FROM enrollments").get() as {
            n: number;
          }
        ).n,
      ).toBe(n);
    } finally {
      db.close();
    }
  });
  it("delegation revocation immediately removes capability and content deletion remains Admin-only", () => {
    const db = fixture();
    try {
      const g = grant(db, adminActor(1), 5, "manage_academics", {
        kind: "program",
        id: 2,
      });
      expect(
        canManage(db, userActor(5), "manage_academics", {
          kind: "program",
          id: 2,
        }),
      ).toBe(true);
      expect(() =>
        mutateAcademic(db, userActor(5), "programs", 2, "delete"),
      ).toThrow("administrador");
      revokeGrant(db, adminActor(1), g);
      expect(
        canManage(db, userActor(5), "manage_academics", {
          kind: "program",
          id: 2,
        }),
      ).toBe(false);
      db.prepare("UPDATE users SET active=0 WHERE id=5").run();
      expect(() =>
        grant(db, adminActor(1), 5, "manage_schedule", {
          kind: "program",
          id: 2,
        }),
      ).toThrow("ativa");
    } finally {
      db.close();
    }
  });
  it("cover update and removal are denied to a manager despite an academic grant", async () => {
    const db = fixture();
    try {
      grant(db, adminActor(1), 5, "manage_academics", {
        kind: "institution",
        id: 1,
      });
      await expect(
        saveOfferingCover(db, userActor(5), 1, Buffer.from("x")),
      ).rejects.toThrow("permissão");
      await expect(removeOfferingCover(db, userActor(5), 1)).rejects.toThrow(
        "permissão",
      );
    } finally {
      db.close();
    }
  });
  it("archiving a populated course preserves cohorts and enrollment history, reactivation restores its visibility", () => {
    const db = fixture();
    try {
      const before = db.prepare("SELECT * FROM enrollments ORDER BY id").all();
      mutateAcademic(db, adminActor(1), "programs", 1, "archive");
      expect(db.prepare("SELECT * FROM enrollments ORDER BY id").all()).toEqual(
        before,
      );
      expect(
        db.prepare("SELECT 1 FROM cohorts WHERE program_id=1").get(),
      ).toBeDefined();
      mutateAcademic(db, adminActor(1), "programs", 1, "reactivate");
      expect(
        (
          db.prepare("SELECT archived_at FROM programs WHERE id=1").get() as {
            archived_at: null;
          }
        ).archived_at,
      ).toBeNull();
    } finally {
      db.close();
    }
  });
  it("an unconverted legacy offering also prevents deleting a mapped course", () => {
    const db = fixture(),
      legacy = createMigratedTestDatabase();
    try {
      const id = createProgram(
        db,
        adminActor(1),
        1,
        "OLD",
        "Curso com histórico",
        "OLD",
      );
      legacy.sqlite
        .prepare(
          "INSERT INTO programs(id,name,active) VALUES(999,'Curso antigo',1)",
        )
        .run();
      legacy.sqlite
        .prepare(
          "INSERT INTO subjects(id,name,active) VALUES(999,'Disciplina antiga',1)",
        )
        .run();
      legacy.sqlite
        .prepare(
          "INSERT INTO academic_periods(id,label,starts_on,ends_on,active) VALUES(999,'2030.1','2030-01-01','2030-12-31',1)",
        )
        .run();
      legacy.sqlite
        .prepare(
          "INSERT INTO subject_offerings(subject_id,program_id,academic_period_id,status) VALUES(999,999,999,'active')",
        )
        .run();
      db.prepare(
        "INSERT INTO academic_legacy_ids(entity,canonical_id,legacy_id) VALUES('programs',?,999)",
      ).run(id);
      expect(
        previewAcademicRemoval(db, adminActor(1), "programs", id, legacy)
          .canDelete,
      ).toBe(false);
    } finally {
      db.close();
      legacy.close();
    }
  });
  it("new records cannot be added under an archived institution", () => {
    const db = fixture();
    try {
      const id = createInstitution(db, adminActor(1), "Instituição arquivada");
      mutateAcademic(db, adminActor(1), "institutions", id, "archive");
      expect(() =>
        createProgram(db, adminActor(1), id, "NEW", "Novo curso", "NEW"),
      ).toThrow("Reative");
      mutateAcademic(db, adminActor(1), "institutions", id, "reactivate");
      expect(
        createProgram(db, adminActor(1), id, "NEW", "Novo curso", "NEW"),
      ).toBeGreaterThan(0);
    } finally {
      db.close();
    }
  });
});
