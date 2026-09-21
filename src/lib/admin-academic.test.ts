import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { bootstrapFirstAdmin } from "@/lib/access";
import {
  createAcademicPeriod,
  createProgram,
  updateProgram,
} from "@/lib/academic";
import type { DatabaseConnection } from "@/lib/db/client";
import { getInstitutionName, updateInstitutionName } from "@/lib/institution";
import { createMigratedTestDatabase } from "@/lib/test-database";

import {
  getAdminAcademicData,
  runAuditedAcademicMutation,
  setCurrentAcademicPeriod,
} from "./admin-academic";

describe("operações administrativas auditadas", () => {
  let connection: DatabaseConnection;
  let adminId: number;

  beforeEach(async () => {
    connection = createMigratedTestDatabase();
    adminId = (
      await bootstrapFirstAdmin(
        {
          displayName: "Administradora Teste",
          login: "admin.teste",
          password: "senha-local-forte-123",
          language: "pt-BR",
        },
        connection,
      )
    ).id;
  });

  afterEach(() => connection.close());

  it("cria, atualiza e audita dados acadêmicos", () => {
    const program = runAuditedAcademicMutation(
      adminId,
      "academic.program_create",
      "program",
      (database) =>
        createProgram({ code: "TST", name: "Programa Teste" }, database),
      connection,
    );
    runAuditedAcademicMutation(
      adminId,
      "academic.program_update",
      "program",
      (database) =>
        updateProgram(
          program.id,
          { code: "TST", name: "Programa Atualizado", active: true },
          database,
        ),
      connection,
    );

    expect(getAdminAcademicData(connection).programs[0]?.name).toBe(
      "Programa Atualizado",
    );
    expect(
      connection.sqlite
        .prepare(
          "select count(*) as count from audit_events where target_type = 'program'",
        )
        .get(),
    ).toEqual({ count: 2 });
  });

  it("define somente um período ativo como atual", () => {
    const active = createAcademicPeriod(
      { label: "2030.1", startsOn: "2030-01-01", endsOn: "2030-06-30" },
      connection,
    );
    const inactive = createAcademicPeriod(
      {
        label: "2030.2",
        startsOn: "2030-07-01",
        endsOn: "2030-12-31",
        active: false,
      },
      connection,
    );

    setCurrentAcademicPeriod(adminId, active.id, connection);
    expect(getAdminAcademicData(connection).currentPeriodId).toBe(active.id);
    expect(() =>
      setCurrentAcademicPeriod(adminId, inactive.id, connection),
    ).toThrow();
  });

  it("configura a instituição sem registrar seu valor na auditoria", () => {
    updateInstitutionName(adminId, "Instituição Demonstrativa", connection);
    expect(getInstitutionName(connection)).toBe("Instituição Demonstrativa");
    const audit = connection.sqlite
      .prepare(
        "select summary from audit_events where action = 'institution.update' order by id desc limit 1",
      )
      .get() as { summary: string };
    expect(audit.summary).toBe("institution display name updated");
    expect(audit.summary).not.toContain("Demonstrativa");
  });
});
