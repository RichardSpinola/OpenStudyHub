import { adminActor, userActor } from "./actor";
import { describe, it, expect, afterEach } from "vitest";
import {
  mkdtempSync,
  mkdirSync,
  rmSync,
  writeFileSync,
  symlinkSync,
  copyFileSync,
  appendFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createMigratedTestDatabase } from "@/lib/test-database";
import { openV2Database, migrateV2 } from "./database";
import { seedV2Fake } from "./fixtures";
import { canManage, canReadPrivate, grant, revokeGrant } from "./access";
import {
  createCohort,
  createOffering,
  archiveAcademic,
  deleteUnusedAcademic,
  renameAcademic,
} from "./academics";
import {
  previewV1Import,
  loadV1ImportMatrix,
  stageIdMapping,
} from "./importer";
import {
  LocalStorageProvider,
  StorageRegistry,
  storeObject,
  readObject,
} from "./storage";
import { validateFakeReset } from "../../../scripts/reset-v2-fake";
import { deactivateUser } from "./lifecycle";

const dbs: ReturnType<typeof openV2Database>[] = [];
const dirs: string[] = [];
afterEach(() => {
  for (const db of dbs.splice(0)) db.close();
  for (const dir of dirs.splice(0))
    rmSync(dir, { recursive: true, force: true });
});
function fixture() {
  const db = openV2Database(":memory:");
  dbs.push(db);
  migrateV2(db);
  seedV2Fake(db);
  return db;
}

describe("V2 structural foundation", () => {
  it("creates deterministic clean schema and validates SQLite relations", () => {
    const db = fixture();
    migrateV2(db);
    expect(
      (
        db.prepare("SELECT count(*) n FROM v2_migration_log").get() as {
          n: number;
        }
      ).n,
    ).toBe(8);
    expect(db.pragma("foreign_key_check")).toEqual([]);
    expect(db.pragma("integrity_check")).toEqual([{ integrity_check: "ok" }]);
    expect(
      (db.prepare("SELECT count(*) n FROM programs").get() as { n: number }).n,
    ).toBe(2);
    expect(db.pragma("busy_timeout", { simple: true })).toBe(5000);
  });
  it("detects modified versioned migrations", () => {
    const db = openV2Database(":memory:");
    dbs.push(db);
    const dir = mkdtempSync(join(tmpdir(), "osh-v2-migrations-"));
    dirs.push(dir);
    const source = join(process.cwd(), "v2-migrations", "0000_foundation.sql");
    const target = join(dir, "0000_foundation.sql");
    copyFileSync(source, target);
    migrateV2(db, dir);
    appendFileSync(target, "\n-- changed\n");
    expect(() => migrateV2(db, dir)).toThrow("migration changed");
  });
  it("keeps curriculum ordinal distinct from real period and protects cross-program links", () => {
    const db = fixture();
    const row = db
      .prepare(
        "SELECT cs.ordinal,ap.label FROM cohort_periods cp JOIN curriculum_semesters cs ON cs.id=cp.semester_id JOIN academic_periods ap ON ap.id=cp.period_id WHERE cp.id=2",
      )
      .get() as { ordinal: number; label: string };
    expect(row).toEqual({ ordinal: 2, label: "2030.2" });
    expect(() =>
      db
        .prepare(
          "INSERT INTO cohort_periods(cohort_id,period_id,semester_id,state) VALUES(3,2,2,'planned')",
        )
        .run(),
    ).toThrow();
    expect(() =>
      createCohort(db, adminActor(1), {
        programId: 1,
        curriculumId: 2,
        shiftId: 1,
        code: "wrong",
        name: "Wrong",
      }),
    ).toThrow();
    expect(() =>
      createOffering(db, adminActor(1), {
        subjectId: 1,
        programId: 2,
        periodId: 2,
        curriculumSubjectId: 1,
      }),
    ).toThrow();
    expect(() =>
      db.prepare("UPDATE offerings SET program_id=2 WHERE id=1").run(),
    ).toThrow();
    expect(
      (
        db
          .prepare(
            "SELECT count(*) n FROM offerings WHERE subject_id=1 AND period_id=1",
          )
          .get() as { n: number }
      ).n,
    ).toBe(2);
    expect(
      (
        db
          .prepare(
            "SELECT count(*) n FROM enrollments WHERE source='exception'",
          )
          .get() as { n: number }
      ).n,
    ).toBe(2);
  });
  it("scopes grants and lets admin manage all without private-content bypass", () => {
    const db = fixture();
    expect(
      canManage(db, adminActor(1), "manage_schedule", {
        kind: "offering",
        id: 4,
      }),
    ).toBe(true);
    expect(
      canManage(db, userActor(2), "manage_schedule", {
        kind: "offering",
        id: 1,
      }),
    ).toBe(true);
    expect(
      canManage(db, userActor(2), "manage_schedule", {
        kind: "offering",
        id: 4,
      }),
    ).toBe(false);
    expect(
      canManage(db, userActor(5), "manage_academics", {
        kind: "program",
        id: 2,
      }),
    ).toBe(true);
    expect(
      canManage(db, userActor(5), "manage_academics", {
        kind: "program",
        id: 1,
      }),
    ).toBe(false);
    expect(canReadPrivate(3, 1, new Set())).toBe(false);
    expect(canReadPrivate(3, 2, new Set())).toBe(false);
    expect(canReadPrivate(3, 2, new Set([2]))).toBe(true);
    expect(() =>
      grant(db, userActor(2), 3, "manage_schedule", { kind: "program", id: 1 }),
    ).toThrow("Admin required");
    const id = grant(db, adminActor(1), 3, "manage_schedule", {
      kind: "cohort",
      id: 1,
    });
    expect(
      canManage(db, userActor(3), "manage_schedule", { kind: "cohort", id: 1 }),
    ).toBe(true);
    revokeGrant(db, adminActor(1), id);
    expect(
      canManage(db, userActor(3), "manage_schedule", { kind: "cohort", id: 1 }),
    ).toBe(false);
  });
  it("archives history, rejects dependent hard-delete and keeps audit metadata minimal", () => {
    const db = fixture();
    renameAcademic(db, adminActor(1), "programs", 1, "Curso Renomeado");
    expect(
      (
        db.prepare("SELECT name FROM programs WHERE id=1").get() as {
          name: string;
        }
      ).name,
    ).toBe("Curso Renomeado");
    archiveAcademic(db, adminActor(1), "offerings", 1);
    expect(
      (
        db.prepare("SELECT archived_at n FROM offerings WHERE id=1").get() as {
          n: number;
        }
      ).n,
    ).toBeGreaterThan(0);
    expect(() =>
      deleteUnusedAcademic(db, adminActor(1), "offerings", 1),
    ).toThrow();
    expect(
      (
        db.prepare("SELECT count(*) n FROM offerings WHERE id=1").get() as {
          n: number;
        }
      ).n,
    ).toBe(1);
    const columns = (
      db.pragma("table_info(admin_audit_events)") as { name: string }[]
    ).map((x) => x.name);
    expect(columns).toEqual([
      "id",
      "actor_admin_id",
      "actor_user_id",
      "action",
      "target_type",
      "target_id",
      "occurred_at",
    ]);
    expect(
      (
        db
          .prepare(
            "SELECT count(*) n FROM admin_audit_events WHERE action='academic.archive'",
          )
          .get() as { n: number }
      ).n,
    ).toBe(1);
    db.prepare(
      "INSERT INTO subjects(id,institution_id,name) VALUES(99,1,'Unused fake')",
    ).run();
    deleteUnusedAcademic(db, adminActor(1), "subjects", 99);
    expect(
      (
        db.prepare("SELECT count(*) n FROM subjects WHERE id=99").get() as {
          n: number;
        }
      ).n,
    ).toBe(0);
    expect(() => deactivateUser(db, adminActor(1), 1)).toThrow("User missing");
    deactivateUser(db, adminActor(1), 2);
    expect(
      canManage(db, userActor(2), "manage_schedule", {
        kind: "offering",
        id: 1,
      }),
    ).toBe(false);
  });
  it("stores local objects with opaque keys and refuses traversal/symlinks", async () => {
    const db = fixture();
    const dir = mkdtempSync(join(tmpdir(), "osh-v2-storage-"));
    dirs.push(dir);
    const provider = new LocalStorageProvider(dir);
    const registry = new StorageRegistry();
    registry.register("fake-local", provider);
    const id = await storeObject(
      db,
      registry,
      "fake-local",
      Buffer.from("fake bytes"),
    );
    expect(Buffer.from(await readObject(db, registry, id)).toString()).toBe(
      "fake bytes",
    );
    expect(() => provider.get("../secret")).toThrow("Invalid storage key");
    const link = join(dir, "link");
    symlinkSync(dir, link);
    expect(() => new LocalStorageProvider(link)).toThrow(
      "Symlinked storage root refused",
    );
  });
  it("allows reset only for marked sibling fake runtime and dedicated DB path", () => {
    const base = mkdtempSync(join(tmpdir(), "osh-v2-reset-"));
    dirs.push(base);
    const repo = join(base, "OpenStudyHub-v2-dev"),
      runtime = join(base, "OpenStudyHub-v2-runtime");
    mkdirSync(repo);
    mkdirSync(join(runtime, "data"), { recursive: true });
    writeFileSync(
      join(runtime, ".fake-runtime-marker"),
      "OPENSTUDYHUB_V2_FAKE_RUNTIME_ONLY\n",
    );
    const input = {
      repo,
      runtime,
      dbPath: join(runtime, "data", "v2-fake.db"),
      nodeEnv: "test",
      consent: "RESET_FAKE_V2_ONLY",
      args: ["--confirm-reset-fake-v2"],
    };
    expect(validateFakeReset(input)).toBe(input.dbPath);
    expect(() =>
      validateFakeReset({ ...input, dbPath: join(runtime, "data", "real.db") }),
    ).toThrow();
    expect(() =>
      validateFakeReset({ ...input, nodeEnv: "production" }),
    ).toThrow();
    expect(() => validateFakeReset({ ...input, consent: "" })).toThrow();
    const other = mkdtempSync(join(tmpdir(), "osh-v2-outside-"));
    dirs.push(other);
    rmSync(join(runtime, "data"), { recursive: true });
    symlinkSync(other, join(runtime, "data"));
    expect(() => validateFakeReset(input)).toThrow();
  });
  it("classifies all V1 tables, blocks ambiguous curriculum and global Classroom mapping", () => {
    const matrix = loadV1ImportMatrix();
    expect(matrix.size).toBe(50);
    expect(matrix.get("instructors")).toBe("MIGRATE");
    expect(matrix.get("subject_offerings")).toBe("TRANSFORM");
    expect(matrix.get("google_connections")).toBe("REVIEW");
    expect(matrix.get("sessions")).toBe("SKIP/RUNTIME");
    const v1 = createMigratedTestDatabase();
    try {
      v1.sqlite
        .prepare("INSERT INTO subjects(id,name) VALUES(1,'Fictícia')")
        .run();
      v1.sqlite
        .prepare("INSERT INTO programs(id,name) VALUES(1,'Curso Fake')")
        .run();
      v1.sqlite
        .prepare(
          "INSERT INTO academic_periods(id,label,starts_on,ends_on) VALUES(1,'2030.1','2030-02-01','2030-06-01')",
        )
        .run();
      v1.sqlite
        .prepare(
          "INSERT INTO subject_offerings(id,subject_id,program_id,academic_period_id,curriculum_term) VALUES(1,1,1,1,'talvez 2')",
        )
        .run();
      v1.sqlite
        .prepare(
          "INSERT INTO offering_google_integrations(offering_id,classroom_course_id) VALUES(1,'fake-course')",
        )
        .run();
      v1.sqlite
        .prepare(
          "INSERT INTO users(display_name,login,password_hash,role) VALUES('Admin Legado Fictício','legacy.fake','fake-hash','admin')",
        )
        .run();
      const target = fixture();
      const preview = previewV1Import(v1.sqlite, target, matrix);
      expect(preview.rows).toHaveLength(50);
      const reasons = (
        target
          .prepare("SELECT reason_code FROM import_review_items WHERE run_id=?")
          .all(preview.runId) as { reason_code: string }[]
      ).map((x) => x.reason_code);
      expect(reasons).toContain("curriculum_term_unverified");
      expect(reasons).toContain("classroom_mapping_not_personal");
      expect(reasons).toContain("legacy_role_not_control_admin");
      expect(
        (
          target.prepare("SELECT count(*) n FROM admin_accounts").get() as {
            n: number;
          }
        ).n,
      ).toBe(1);
      expect(() =>
        stageIdMapping(
          target,
          preview.runId,
          "google_connections",
          1,
          "google_connections",
          1,
          matrix,
        ),
      ).toThrow();
      stageIdMapping(
        target,
        preview.runId,
        "instructors",
        1,
        "instructors",
        1,
        matrix,
      );
      expect(
        (
          target
            .prepare("SELECT status FROM import_runs WHERE id=?")
            .get(preview.runId) as { status: string }
        ).status,
      ).toBe("blocked");
    } finally {
      v1.close();
    }
  });
});
