import { beforeEach, afterEach, describe, it, expect, vi } from "vitest";
import { createMigratedTestDatabase } from "./test-database";
import type { DatabaseConnection } from "./db/client";
import {
  savePersonalTask,
  listPersonalTasks,
  setPersonalTaskCompleted,
  deletePersonalTask,
} from "./personal-tasks";
import {
  collectCalendarEntries,
  serializeCalendar,
  foldCalendarLine,
  calendarRange,
} from "./calendar-export";
import {
  readTourProgress,
  writeTourProgress,
  productTourContext,
} from "./product-tour";
import { tourSteps } from "./product-tour-catalog";
describe("Personal planning and tour safety", () => {
  let db: DatabaseConnection;
  beforeEach(() => {
    vi.stubEnv("OPENSTUDYHUB_V2_ENABLED", "0");
    db = createMigratedTestDatabase();
    db.sqlite.exec(
      "INSERT INTO users(id,display_name,login,password_hash,role,active,onboarding_version,created_at,updated_at) VALUES(1,'Pessoa A','a','fake','member',1,1,1,1),(2,'Pessoa B','b','fake','member',1,1,1,1)",
    );
  });
  afterEach(() => {
    db.close();
    vi.unstubAllEnvs();
  });
  it("isolates tasks, rejects invalid fields and refuses mutations by another owner", () => {
    const id = savePersonalTask(
      1,
      { title: "Estudar", dueAt: Date.parse("2030-02-04T11:00:00Z") },
      undefined,
      db,
    );
    expect(listPersonalTasks(2, db)).toEqual([]);
    expect(() => savePersonalTask(2, { title: "Outro" }, id, db)).toThrow();
    expect(() => setPersonalTaskCompleted(2, id, true, db)).toThrow();
    expect(() => deletePersonalTask(2, id, db)).toThrow();
    expect(() =>
      savePersonalTask(1, { title: "   " }, undefined, db),
    ).toThrow();
    expect(() =>
      savePersonalTask(1, { title: "X", offeringKey: "v1:999" }, undefined, db),
    ).toThrow();
    setPersonalTaskCompleted(1, id, true, db);
    expect(listPersonalTasks(1, db)[0].completedAt).not.toBeNull();
    setPersonalTaskCompleted(1, id, false, db);
    expect(listPersonalTasks(1, db)[0].completedAt).toBeNull();
  });
  it("exports only the owner’s dated, open tasks inside the requested range", () => {
    savePersonalTask(1, { title: "Sem prazo" }, undefined, db);
    savePersonalTask(
      1,
      { title: "No período", dueAt: Date.parse("2030-02-04T11:00:00Z") },
      undefined,
      db,
    );
    const done = savePersonalTask(
      1,
      { title: "Concluída", dueAt: Date.parse("2030-02-04T11:00:00Z") },
      undefined,
      db,
    );
    setPersonalTaskCompleted(1, done, true, db);
    savePersonalTask(
      2,
      {
        title: "Privada de outra conta",
        dueAt: Date.parse("2030-02-04T11:00:00Z"),
      },
      undefined,
      db,
    );
    expect(
      collectCalendarEntries(
        1,
        "2030-02-01",
        "2030-02-28",
        ["tasks"],
        db,
      ).entries.map((e) => e.title),
    ).toEqual(["No período"]);
  });
  it("limits ranges, rejects impossible dates and avoids empty category exports", () => {
    expect(() =>
      calendarRange("2030-02-30", "2030-03-01", "America/Bahia"),
    ).toThrow();
    expect(() =>
      calendarRange("2030-02-01", "2032-02-01", "America/Bahia"),
    ).toThrow();
    expect(() =>
      collectCalendarEntries(1, "2030-02-01", "2030-02-28", [], db),
    ).toThrow();
    expect(
      calendarRange("2030-02-01", "2030-02-01", "America/Bahia").start,
    ).toBe(Date.parse("2030-02-01T03:00:00Z"));
  });
  it("expands real enrollment schedules using validity and timezone", () => {
    db.sqlite.exec(
      "INSERT INTO programs(id,name) VALUES(1,'Curso');INSERT INTO subjects(id,name) VALUES(1,'Disciplina');INSERT INTO academic_periods(id,label,starts_on,ends_on) VALUES(1,'2030.1','2030-02-01','2030-02-28');INSERT INTO subject_offerings(id,subject_id,program_id,academic_period_id) VALUES(1,1,1,1);INSERT INTO enrollments(user_id,offering_id) VALUES(1,1);INSERT INTO schedule_slots(offering_id,weekday,starts_at_minutes,ends_at_minutes,valid_from,valid_until) VALUES(1,1,480,570,'2030-02-01','2030-02-28');INSERT INTO app_settings(key,value) VALUES('academic.current_period_id','1')",
    );
    const events = collectCalendarEntries(
      1,
      "2030-02-01",
      "2030-03-08",
      ["classes"],
      db,
    ).entries;
    expect(events).toHaveLength(4);
    expect(events[0].startsAt).toBe(Date.parse("2030-02-04T11:00:00Z"));
    expect(events[0].endsAt).toBe(Date.parse("2030-02-04T12:30:00Z"));
    expect(
      collectCalendarEntries(2, "2030-02-01", "2030-02-28", ["classes"], db)
        .entries,
    ).toEqual([]);
  });
  it("uses stable private event identifiers and escapes/folds text safely", () => {
    const e = {
      key: "task-1",
      title: "Estudo, revisão; tópico\\a\nBEGIN:VEVENT",
      startsAt: Date.parse("2030-02-04T11:00:00Z"),
    };
    const first = serializeCalendar([e], 1, "https://hub.example.org", 0),
      next = serializeCalendar([e], 1, "https://hub.example.org", 1000);
    expect(first.match(/UID:(.*)/)?.[1]).toBe(next.match(/UID:(.*)/)?.[1]);
    expect(first.match(/UID:(.*)/)?.[1]).not.toBe(
      serializeCalendar([e], 2, "https://hub.example.org", 0).match(
        /UID:(.*)/,
      )?.[1],
    );
    expect(first).toContain(
      "SUMMARY:Estudo\\, revisão\\; tópico\\\\a\\nBEGIN:VEVENT",
    );
    expect(
      first.split("\r\n").filter((l) => l === "BEGIN:VEVENT"),
    ).toHaveLength(1);
    const folded = foldCalendarLine("SUMMARY:" + "Ação 🧠".repeat(40));
    expect(folded.split("\r\n").every((l) => Buffer.byteLength(l) <= 75)).toBe(
      true,
    );
    expect(folded.replace(/\r\n /g, "")).toBe(
      "SUMMARY:" + "Ação 🧠".repeat(40),
    );
  });
  it("saves/resumes the tour independently of profile preferences and rejects stale updates", () => {
    const before = db.sqlite.prepare("SELECT * FROM users WHERE id=1").get();
    const result = writeTourProgress(
      1,
      {
        edition: 1,
        mode: "full",
        status: "active",
        stepId: "today",
        revision: 0,
      },
      tourSteps,
      db,
    );
    expect(result.conflict).toBe(false);
    const paused = writeTourProgress(
      1,
      {
        edition: 1,
        mode: "full",
        status: "paused",
        stepId: "today",
        revision: 1,
      },
      tourSteps,
      db,
    );
    expect(paused.progress?.status).toBe("paused");
    expect(
      writeTourProgress(
        1,
        {
          edition: 1,
          mode: "full",
          status: "dismissed",
          stepId: null,
          revision: 1,
        },
        tourSteps,
        db,
      ).conflict,
    ).toBe(true);
    expect(readTourProgress(2, db)).toBeNull();
    expect(db.sqlite.prepare("SELECT * FROM users WHERE id=1").get()).toEqual(
      before,
    );
  });
  it("dismisses this edition without forcing first-run setup or changing other users", () => {
    writeTourProgress(
      1,
      {
        edition: 1,
        mode: "full",
        status: "dismissed",
        stepId: null,
        revision: 0,
      },
      tourSteps,
      db,
    );
    expect(productTourContext(1, db).progress?.status).toBe("dismissed");
    expect(productTourContext(2, db).progress).toBeNull();
    expect(() =>
      writeTourProgress(
        1,
        {
          edition: 1,
          mode: "news",
          status: "active",
          stepId: "home",
          revision: 1,
        },
        tourSteps,
        db,
      ),
    ).toThrow();
    db.sqlite
      .prepare(
        "INSERT INTO app_settings(key,value) VALUES('tour.invitation_enabled','false')",
      )
      .run();
    const ctx = productTourContext(1, db);
    expect(ctx.invitationEnabled).toBe(false);
    expect(ctx.steps.length).toBeGreaterThan(0);
    expect(ctx.steps.some((s) => s.feature === "extras")).toBe(false);
  });
});
