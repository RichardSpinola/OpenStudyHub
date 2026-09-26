import { copyFileSync, mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { openV2Database, migrateV2 } from "@/lib/v2/database";
import {
  defaultAcademicPreferences,
  getAcademicPreferencesFromDb,
  saveAcademicPreferencesToDb,
} from "@/lib/academic-preferences";

describe("Phase 4 preference migration", () => {
  it("converts an existing TUI preference to Legacy and moves academic focus out of appearance", () => {
    const folder = mkdtempSync(join(tmpdir(), "osh-phase4-migrations-"));
    const db = openV2Database(":memory:");
    try {
      const source = resolve("v2-migrations");
      for (const name of readdirSync(source).filter((file) =>
        /^000[0-8]_.*\.sql$/.test(file),
      ))
        copyFileSync(join(source, name), join(folder, name));
      migrateV2(db, folder);
      db.prepare(
        "INSERT INTO users(id,login,display_name,password_hash) VALUES(1,'student.fake','Estudante','fake')",
      ).run();
      db.prepare(
        "INSERT INTO user_appearance(user_id,theme,overview_focus,updated_at) VALUES(1,'tui','timeline',1)",
      ).run();
      copyFileSync(
        join(source, "0009_phase4_feedback.sql"),
        join(folder, "0009_phase4_feedback.sql"),
      );
      migrateV2(db, folder);
      expect(
        (
          db
            .prepare("SELECT theme FROM user_appearance WHERE user_id=1")
            .get() as {
            theme: string;
          }
        ).theme,
      ).toBe("legacy");
      expect(getAcademicPreferencesFromDb(db, 1)).toEqual({
        overviewFocus: "timeline",
        showSubjectHistory: false,
      });
      expect(() =>
        db
          .prepare("UPDATE user_appearance SET theme='tui' WHERE user_id=1")
          .run(),
      ).toThrow();
      expect(db.pragma("integrity_check")).toEqual([{ integrity_check: "ok" }]);
      expect(db.pragma("foreign_key_check")).toEqual([]);
    } finally {
      db.close();
      rmSync(folder, { recursive: true, force: true });
    }
  });

  it("keeps history visibility and Mural/Timeline selection private to each user", () => {
    const db = openV2Database(":memory:");
    try {
      migrateV2(db);
      db.prepare(
        "INSERT INTO users(id,login,display_name,password_hash) VALUES(1,'a.fake','A','fake'),(2,'b.fake','B','fake')",
      ).run();
      expect(getAcademicPreferencesFromDb(db, 1)).toEqual(
        defaultAcademicPreferences,
      );
      saveAcademicPreferencesToDb(db, 1, {
        overviewFocus: "timeline",
        showSubjectHistory: true,
      });
      expect(getAcademicPreferencesFromDb(db, 1)).toEqual({
        overviewFocus: "timeline",
        showSubjectHistory: true,
      });
      expect(getAcademicPreferencesFromDb(db, 2)).toEqual(
        defaultAcademicPreferences,
      );
    } finally {
      db.close();
    }
  });
});
