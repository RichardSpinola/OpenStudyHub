import { describe, expect, it } from "vitest";
import { openV2Database, migrateV2 } from "./v2/database";
import {
  defaultHomePresentation,
  readHomePresentation,
  writeHomePresentation,
} from "./home-presentation";
import { figletFontOptions } from "./ascii-fonts";

describe("personal Home presentation", () => {
  it("upgrades an existing database without changing brand or another person's preferences", () => {
    const db = openV2Database(":memory:");
    try {
      migrateV2(db);
      db.prepare(
        "INSERT INTO users(id,login,display_name,password_hash) VALUES(1,'one.fake','One','fake'),(2,'two.fake','Two','fake')",
      ).run();
      const before = db.prepare("SELECT * FROM users ORDER BY id").all();
      expect(readHomePresentation(db, 1)).toEqual(defaultHomePresentation);
      for (const font of figletFontOptions) {
        writeHomePresentation(db, 1, {
          ...defaultHomePresentation,
          asciiFont: font,
          wallpaperX: 0,
          wallpaperY: 100,
          wallpaperFit: "contain",
          wallpaperZoom: 1.75,
          controlEnabled: false,
          controlX: 20,
          controlY: 70,
        });
        expect(readHomePresentation(db, 1)).toMatchObject({
          asciiFont: font,
          wallpaperX: 0,
          wallpaperY: 100,
          wallpaperFit: "contain",
          wallpaperZoom: 1.75,
          controlEnabled: false,
          controlX: 20,
          controlY: 70,
        });
      }
      expect(readHomePresentation(db, 2)).toEqual(defaultHomePresentation);
      expect(db.prepare("SELECT * FROM users ORDER BY id").all()).toEqual(
        before,
      );
      migrateV2(db);
      expect(readHomePresentation(db, 1).asciiFont).toBe("Three Point");
    } finally {
      db.close();
    }
  });
  it("rejects extra identity fields, invalid geometry and unsupported fonts", () => {
    const db = openV2Database(":memory:");
    try {
      migrateV2(db);
      for (const invalid of [
        { wallpaperX: 101 },
        { wallpaperZoom: 4 },
        { controlX: -1 },
        { controlY: 101 },
        { controlEnabled: "false" },
        { wallpaperY: -1 },
        { wallpaperFit: "url(example)" },
        { asciiFont: "unknown" },
        { brandText: "Changed" },
        { userId: 2 },
      ])
        expect(() =>
          writeHomePresentation(db, 1, {
            ...defaultHomePresentation,
            ...invalid,
          }),
        ).toThrow();
      expect(() =>
        writeHomePresentation(db, 999, defaultHomePresentation),
      ).toThrow();
    } finally {
      db.close();
    }
  });
});
