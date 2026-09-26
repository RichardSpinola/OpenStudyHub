import { describe, expect, it } from "vitest";
import { openV2Database, migrateV2 } from "@/lib/v2/database";
import {
  defaultAppearance,
  getAppearanceFromDb,
  saveAppearanceToDb,
} from "./appearance";

describe("V2 appearance", () => {
  it("persists independent appearance preferences and normalizes the former Custom theme", () => {
    const db = openV2Database(":memory:");
    try {
      migrateV2(db);
      db.prepare(
        "INSERT INTO users(id,login,display_name,password_hash) VALUES(1,'student.fake','Estudante','fake')",
      ).run();
      db.prepare(
        "INSERT INTO users(id,login,display_name,password_hash) VALUES(2,'other.fake','Outro','fake')",
      ).run();
      expect(getAppearanceFromDb(db, 1)).toEqual(defaultAppearance);
      expect(getAppearanceFromDb(db, 2)).toEqual(defaultAppearance);
      saveAppearanceToDb(db, 1, {
        ...defaultAppearance,
        theme: "legacy",
        mode: "light",
        density: "compact",
        accent: "green",
        navigationLayout: "classic",
        searchEngine: "scholar",
      });
      expect(getAppearanceFromDb(db, 1)).toMatchObject({
        theme: "legacy",
        mode: "light",
        density: "compact",
        navigationLayout: "classic",
        searchEngine: "scholar",
      });
      saveAppearanceToDb(db, 1, {
        ...defaultAppearance,
        theme: "material",
        mode: "system",
        density: "comfortable",
        accent: "custom",
        customAccent: "#bb4400",
        searchEngine: "ecosia",
      });
      expect(getAppearanceFromDb(db, 1)).toMatchObject({
        theme: "material",
        mode: "system",
        density: "comfortable",
        accent: "custom",
        customAccent: "#bb4400",
      });
      expect(getAppearanceFromDb(db, 2)).toEqual(defaultAppearance);
      db.prepare(
        "UPDATE user_appearance SET theme='custom' WHERE user_id=1",
      ).run();
      expect(getAppearanceFromDb(db, 1)).toMatchObject({
        theme: "material",
        customAccent: "#bb4400",
      });
      expect(() =>
        saveAppearanceToDb(db, 1, {
          ...defaultAppearance,
          accent: "red; background:url(example)",
        }),
      ).toThrow();
    } finally {
      db.close();
    }
  });
});
