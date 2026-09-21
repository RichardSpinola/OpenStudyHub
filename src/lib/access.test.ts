import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { DatabaseConnection } from "@/lib/db/client";
import { createMigratedTestDatabase } from "@/lib/test-database";

import {
  authenticateLocalUser,
  bootstrapFirstAdmin,
  createMember,
  isSetupRequired,
  listUsers,
  loginRateLimitPolicy,
  resetUserPassword,
  setUserActive,
  updateUserRole,
} from "./access";
import { createSession, getSessionByToken } from "./session";

const adminInput = {
  displayName: "Administradora Teste",
  login: "admin.teste",
  password: "senha-local-forte-123",
  institutionName: "Instituição Demonstrativa",
  language: "pt-BR" as const,
};

describe("acesso e administração local", () => {
  let connection: DatabaseConnection;

  beforeEach(() => {
    connection = createMigratedTestDatabase();
  });

  afterEach(() => connection.close());

  it("faz bootstrap atômico do primeiro admin e fecha o setup", async () => {
    expect(isSetupRequired(connection)).toBe(true);
    const admin = await bootstrapFirstAdmin(adminInput, connection);
    expect(admin.role).toBe("admin");
    expect(isSetupRequired(connection)).toBe(false);
    await expect(bootstrapFirstAdmin(adminInput, connection)).rejects.toThrow();

    const stored = connection.sqlite
      .prepare("select password_hash as passwordHash from users where id = ?")
      .get(admin.id) as { passwordHash: string };
    expect(stored.passwordHash).toMatch(/^\$argon2id\$/u);
    expect(stored.passwordHash).not.toContain(adminInput.password);
  });

  it("cria somente o contexto acadêmico inicial informado no onboarding", async () => {
    const admin = await bootstrapFirstAdmin(
      {
        ...adminInput,
        academic: {
          programName: "Computação",
          programShortName: "COMP",
          cohortName: "Turma 2030",
          periodLabel: "2030.1",
          periodStartsOn: "2030-01-15",
          periodEndsOn: "2030-06-30",
          subjectName: "Introdução à Programação",
          expectedPeriods: 8,
          includeCohortInStorage: true,
        },
      },
      connection,
    );

    expect(
      connection.sqlite
        .prepare(
          `select
             (select count(*) from programs) as programs,
             (select count(*) from cohorts) as cohorts,
             (select count(*) from academic_periods) as periods,
             (select count(*) from subjects) as subjects,
             (select count(*) from subject_offerings) as offerings,
             (select count(*) from enrollments where user_id = ?) as enrollments,
             (select count(*) from user_academic_memberships where user_id = ?) as memberships`,
        )
        .get(admin.id, admin.id),
    ).toEqual({
      programs: 1,
      cohorts: 1,
      periods: 1,
      subjects: 1,
      offerings: 1,
      enrollments: 1,
      memberships: 1,
    });
    expect(
      connection.sqlite
        .prepare(
          "select include_cohort as includeCohort from storage_settings where id = 1",
        )
        .get(),
    ).toEqual({ includeCohort: 1 });
    expect(
      connection.sqlite
        .prepare(
          "select value from app_settings where key = 'academic.expected_period_count'",
        )
        .get(),
    ).toEqual({ value: "8" });
  });

  it("autentica sem revelar se o login existe", async () => {
    await bootstrapFirstAdmin(adminInput, connection);
    await expect(
      authenticateLocalUser(adminInput.login, adminInput.password, connection),
    ).resolves.toMatchObject({ login: adminInput.login, role: "admin" });
    await expect(
      authenticateLocalUser("nao.existe", "senha-incorreta", connection),
    ).resolves.toBeNull();
  });

  it("bloqueia localmente depois do limite de falhas", async () => {
    await bootstrapFirstAdmin(adminInput, connection);
    const now = 1_900_000_000_000;
    for (
      let attempt = 0;
      attempt < loginRateLimitPolicy.failureLimit;
      attempt += 1
    ) {
      await authenticateLocalUser(
        adminInput.login,
        "senha-incorreta",
        connection,
        now + attempt,
      );
    }
    await expect(
      authenticateLocalUser(
        adminInput.login,
        adminInput.password,
        connection,
        now + 10,
      ),
    ).resolves.toBeNull();
  });

  it("administra usuários sem permitir remover o último admin ativo", async () => {
    const admin = await bootstrapFirstAdmin(adminInput, connection);
    const member = await createMember(
      admin.id,
      {
        displayName: "Membro Teste",
        login: "membro.teste",
        password: "outra-senha-forte-456",
      },
      connection,
    );
    expect(() =>
      updateUserRole(admin.id, admin.id, "member", connection),
    ).toThrow();
    expect(() =>
      setUserActive(admin.id, admin.id, false, connection),
    ).toThrow();

    updateUserRole(admin.id, member.id, "admin", connection);
    updateUserRole(admin.id, admin.id, "member", connection);
    expect(listUsers(connection).find(({ id }) => id === admin.id)?.role).toBe(
      "member",
    );
  });

  it("revoga sessões ao resetar senha", async () => {
    const admin = await bootstrapFirstAdmin(adminInput, connection);
    const session = createSession(admin.id, connection);
    expect(getSessionByToken(session.token, connection)).not.toBeNull();

    await resetUserPassword(
      admin.id,
      admin.id,
      "senha-local-substituta-789",
      connection,
    );

    expect(getSessionByToken(session.token, connection)).toBeNull();
  });
});
