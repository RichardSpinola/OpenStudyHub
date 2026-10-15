import { describe, expect, it } from "vitest";
import { validateSetupStep } from "./setup-validation";
import { migrateV2, openV2Database } from "./database";
import { bootstrapV2, isSetupPending } from "./auth";
const fields = {
  institution: "Instituto de teste",
  language: "pt-BR",
  timeZone: "America/Bahia",
  login: "admin.teste",
  name: "Pessoa teste",
  password: "Fake-only-password-2026",
  confirmPassword: "Fake-only-password-2026",
  program: "Curso teste",
  code: "CT",
  semesters: "4",
  shift: "Manhã",
  cohort: "Turma 1",
  period: "2030.1",
  startsOn: "2030-01-01",
  endsOn: "2030-06-30",
};
describe("Admin first installation, beginner mistakes", () => {
  it("explains missing fields, login format, weak/mismatched passwords, invalid dates and semester counts", () => {
    expect(validateSetupStep(0, { ...fields, institution: "" })).toContain(
      "obrigatórios",
    );
    expect(validateSetupStep(0, { ...fields, timeZone: "invalid" })).toContain(
      "fuso",
    );
    expect(validateSetupStep(1, { ...fields, login: "tem espaço" })).toContain(
      "login",
    );
    expect(validateSetupStep(1, { ...fields, password: "short" })).toContain(
      "12",
    );
    expect(
      validateSetupStep(1, { ...fields, confirmPassword: "outro" }),
    ).toContain("iguais");
    for (const change of [
      { endsOn: "2029-12-31" },
      { startsOn: "2030-02-30" },
      { semesters: "2.5" },
    ])
      expect(validateSetupStep(2, { ...fields, ...change })).not.toBeNull();
    for (let i = 0; i < 3; i++) expect(validateSetupStep(i, fields)).toBeNull();
  });
  it("creates a fresh institution with timezone/course/cohort/period, rejects invalid attempts without partial data and blocks a second setup", async () => {
    const db = openV2Database(":memory:");
    migrateV2(db);
    try {
      expect(isSetupPending(db)).toBe(true);
      const data = {
        ...fields,
        semesters: 4,
        subject: "Primeira disciplina",
        instructor: "Professor teste",
        location: "Sala 1",
      };
      await expect(
        bootstrapV2(db, { ...data, startsOn: "2030-02-30" }),
      ).rejects.toThrow("estrutura");
      expect(db.prepare("SELECT count(*) n FROM admin_accounts").get()).toEqual(
        { n: 0 },
      );
      await bootstrapV2(db, data);
      expect(isSetupPending(db)).toBe(false);
      expect(
        db.prepare("SELECT time_zone z FROM institution_timezones").get(),
      ).toEqual({ z: "America/Bahia" });
      for (const table of [
        "institutions",
        "programs",
        "cohorts",
        "academic_periods",
        "offerings",
      ])
        expect(db.prepare(`SELECT count(*) n FROM ${table}`).get()).toEqual({
          n: 1,
        });
      expect(
        db.prepare("SELECT count(*) n FROM curriculum_semesters").get(),
      ).toEqual({ n: 4 });
      await expect(bootstrapV2(db, data)).rejects.toThrow("já foi concluído");
      expect(db.pragma("foreign_key_check")).toEqual([]);
    } finally {
      db.close();
    }
  });
});
