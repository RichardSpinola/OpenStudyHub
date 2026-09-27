import { adminActor, userActor } from "./actor";
import { hashPassword } from "../password";
import { afterEach, describe, expect, it } from "vitest";
import { openV2Database, migrateV2, type V2Database } from "./database";
import { seedV2Fake } from "./fixtures";
import {
  bootstrapV2,
  authenticateAdminV2,
  authenticateUserV2,
  sessionAdminV2,
  sessionUserV2,
  setPasswordV2,
  setAdminPasswordV2,
} from "./auth";
import { canManage, canReadPrivate, grant, revokeGrant } from "./access";
import {
  visiblePrograms,
  replaceSchedule,
  previewTransition,
  activateTransition,
  mutateAcademic,
  editAcademicDetails,
} from "./control";
import {
  createV2User,
  editV2User,
  enrollV2,
  previewCohortEnrollment,
  enrollCohort,
  withdrawEnrollment,
  previewUsersCsv,
  applyUsersCsv,
} from "./users";
import {
  createAcademicPeriod,
  createCohortPeriod,
  createCurriculumSemester,
  createInstructor,
  createLocation,
  createOffering,
  createProgram,
  createShift,
  createSubject,
  createCurriculum,
  createCohort,
  addOfferingCohort,
} from "./academics";
let dbs: V2Database[] = [];
afterEach(() => {
  for (const db of dbs) db.close();
  dbs = [];
});
const db = () => {
  const x = openV2Database(":memory:");
  dbs.push(x);
  migrateV2(x);
  return x;
};
const fixture = () => {
  const x = db();
  seedV2Fake(x);
  return x;
};

describe("Fase 2: Admin e Gestão", () => {
  it("não confunde Admin e usuário com o mesmo número de ID", () => {
    const x = fixture();
    x.prepare(
      "INSERT INTO users(id,login,display_name,password_hash) VALUES(1,'same-id.fake','Usuário Fictício','FAKE_FIXTURE_NO_LOGIN')",
    ).run();
    expect(
      canManage(x, adminActor(1), "manage_schedule", {
        kind: "program",
        id: 2,
      }),
    ).toBe(true);
    expect(
      canManage(x, userActor(1), "manage_schedule", { kind: "program", id: 2 }),
    ).toBe(false);
    const id = grant(x, adminActor(1), 1, "manage_schedule", {
      kind: "program",
      id: 2,
    });
    expect(
      canManage(x, userActor(1), "manage_schedule", { kind: "program", id: 2 }),
    ).toBe(true);
    revokeGrant(x, adminActor(1), id);
    expect(
      canManage(x, userActor(1), "manage_schedule", { kind: "program", id: 2 }),
    ).toBe(false);
  });
  it("separa logins, sessões e senhas Admin dos usuários e do gestor", async () => {
    const x = db();
    seedV2Fake(x, await hashPassword("FicticioLocal!2030"));
    expect(
      await authenticateAdminV2(x, "manager.fake", "FicticioLocal!2030"),
    ).toBeNull();
    expect(
      await authenticateAdminV2(x, "student.a.fake", "FicticioLocal!2030"),
    ).toBeNull();
    expect(
      await authenticateUserV2(x, "admin.fake", "FicticioLocal!2030"),
    ).toBeNull();
    const admin = await authenticateAdminV2(
      x,
      "admin.fake",
      "FicticioLocal!2030",
    );
    const manager = await authenticateUserV2(
      x,
      "manager.fake",
      "FicticioLocal!2030",
    );
    expect(sessionAdminV2(x, admin?.token)?.kind).toBe("admin");
    expect(sessionUserV2(x, admin?.token)).toBeNull();
    expect(sessionUserV2(x, manager?.token)?.kind).toBe("user");
    expect(sessionAdminV2(x, manager?.token)).toBeNull();
    expect(
      (
        x
          .prepare("SELECT count(*) n FROM enrollments WHERE user_id=1")
          .get() as { n: number }
      ).n,
    ).toBe(0);
    await expect(
      setAdminPasswordV2(x, userActor(2), "AnotherFakePass!2030"),
    ).rejects.toThrow("Admin required");
    await setPasswordV2(x, adminActor(1), 2, "AnotherFakePass!2030", true);
    expect(sessionUserV2(x, manager?.token)).toBeNull();
    expect(sessionAdminV2(x, admin?.token)?.kind).toBe("admin");
    expect(
      (
        x
          .prepare(
            "SELECT count(*) n FROM admin_audit_events WHERE actor_admin_id=1 AND actor_user_id IS NULL AND action='user.password_reset'",
          )
          .get() as { n: number }
      ).n,
    ).toBe(1);
  });

  it("registra ações de gestor no audit sem misturar IDs de Admin", () => {
    const x = fixture();
    editAcademicDetails(x, userActor(2), "programs", 1, {
      name: "Curso Fake Revisado",
      code: "CURSO-A",
    });
    const row = x
      .prepare(
        "SELECT actor_admin_id,actor_user_id FROM admin_audit_events WHERE action='academic.edit' AND target_type='programs' AND target_id=1",
      )
      .get() as { actor_admin_id: number | null; actor_user_id: number | null };
    expect(row).toEqual({ actor_admin_id: null, actor_user_id: 2 });
    expect(() =>
      x
        .prepare(
          "INSERT INTO admin_audit_events(actor_admin_id,actor_user_id,action,target_type,target_id) VALUES(1,2,'bad','user',2)",
        )
        .run(),
    ).toThrow();
  });
  it("completa setup uma vez, autentica com Argon2id e revoga sessão ao mudar senha", async () => {
    const x = db();
    const input = {
      login: "admin.demo",
      name: "Admin Demonstração",
      password: "DemoPassword!123",
      institution: "Instituto Falso",
      program: "ADS Exemplo",
      code: "ADS",
      shift: "Manhã",
      cohort: "Turma Fictícia",
      period: "2030.1",
      startsOn: "2030-02-01",
      endsOn: "2030-06-30",
      semesters: 4,
    };
    const id = await bootstrapV2(x, input);
    expect(id).toBe(1);
    expect(
      x
        .prepare("SELECT code,short_name shortName FROM programs WHERE id=1")
        .get(),
    ).toEqual({ code: "ADS", shortName: "ADS" });
    expect(
      (x.prepare("SELECT count(*) n FROM users").get() as { n: number }).n,
    ).toBe(0);
    expect(
      (
        x.prepare("SELECT count(*) n FROM admin_accounts").get() as {
          n: number;
        }
      ).n,
    ).toBe(1);
    await expect(bootstrapV2(x, input)).rejects.toThrow("setup inicial já");
    expect(
      (
        x.prepare("SELECT count(*) n FROM curriculum_semesters").get() as {
          n: number;
        }
      ).n,
    ).toBe(4);
    expect(await authenticateAdminV2(x, "admin.demo", "wrong")).toBeNull();
    expect(
      await authenticateUserV2(x, "admin.demo", input.password),
    ).toBeNull();
    const session = await authenticateAdminV2(x, "admin.demo", input.password);
    expect(sessionAdminV2(x, session?.token)?.kind).toBe("admin");
    expect(sessionUserV2(x, session?.token)).toBeNull();
    await setAdminPasswordV2(x, adminActor(id), "DifferentPassword!456");
    expect(sessionAdminV2(x, session?.token)).toBeNull();
    expect(
      await authenticateAdminV2(x, "admin.demo", "DifferentPassword!456"),
    ).not.toBeNull();
  });
  it("restringe grants por curso e não abre infraestrutura, notas nem mensagens privadas", () => {
    const x = fixture();
    expect(visiblePrograms(x, adminActor(1))).toHaveLength(2);
    expect(visiblePrograms(x, userActor(2)).map((p) => p.id)).toEqual([1]);
    expect(visiblePrograms(x, userActor(5)).map((p) => p.id)).toEqual([2]);
    expect(
      canManage(x, adminActor(1), "manage_schedule", {
        kind: "program",
        id: 2,
      }),
    ).toBe(true);
    expect(
      canManage(x, userActor(2), "manage_schedule", { kind: "program", id: 1 }),
    ).toBe(true);
    expect(
      canManage(x, userActor(2), "manage_schedule", { kind: "program", id: 2 }),
    ).toBe(false);
    expect(() =>
      grant(x, userActor(2), 3, "manage_academics", { kind: "program", id: 1 }),
    ).toThrow("Admin required");
    expect(canReadPrivate(3, 1, new Set())).toBe(false);
    expect(canReadPrivate(3, 2, new Set())).toBe(false);
    expect(canReadPrivate(3, 2, new Set([2]))).toBe(true);
    const g = grant(x, adminActor(1), 2, "manage_academics", {
      kind: "program",
      id: 2,
    });
    expect(
      canManage(x, userActor(2), "manage_academics", {
        kind: "program",
        id: 2,
      }),
    ).toBe(true);
    revokeGrant(x, adminActor(1), g);
    expect(
      canManage(x, userActor(2), "manage_academics", {
        kind: "program",
        id: 2,
      }),
    ).toBe(false);
    const nested = grant(x, adminActor(1), 3, "manage_cohort", {
      kind: "cohort",
      id: 1,
    });
    expect(visiblePrograms(x, userActor(3)).map((p) => p.id)).toEqual([1]);
    expect(
      canManage(x, userActor(3), "manage_cohort", { kind: "cohort", id: 1 }),
    ).toBe(true);
    expect(
      canManage(x, userActor(3), "manage_cohort", { kind: "cohort", id: 2 }),
    ).toBe(false);
    revokeGrant(x, adminActor(1), nested);
  });
  it("mantém CRUD acadêmico íntegro, valida grade e impede delete com dependência", () => {
    const x = fixture();
    const p = createProgram(x, adminActor(1), 1, "C", "Curso C");
    const sh = createShift(x, adminActor(1), 1, "afternoon", "Tarde");
    const cu = createCurriculum(x, adminActor(1), p, "v1");
    const sem = createCurriculumSemester(x, adminActor(1), cu, 1);
    const co = createCohort(x, adminActor(1), {
      programId: p,
      curriculumId: cu,
      shiftId: sh,
      code: "C1",
      name: "Turma C",
    });
    const per = createAcademicPeriod(
      x,
      adminActor(1),
      1,
      "2031.1",
      "2031-01-01",
      "2031-06-30",
    );
    const cp = createCohortPeriod(x, adminActor(1), co, per, sem);
    const sub = createSubject(x, adminActor(1), 1, "Disciplina C");
    const prof = createInstructor(x, adminActor(1), 1, "Professor C");
    const loc = createLocation(x, adminActor(1), 1, "Sala C");
    const off = createOffering(x, adminActor(1), {
      subjectId: sub,
      programId: p,
      periodId: per,
      instructorId: prof,
    });
    expect(
      [p, sh, cu, sem, co, per, cp, sub, prof, loc, off].every(
        Number.isInteger,
      ),
    ).toBe(true);
    expect(() =>
      mutateAcademic(x, adminActor(1), "programs", p, "delete"),
    ).toThrow("Exclusão bloqueada");
    expect(() =>
      mutateAcademic(x, adminActor(1), "programs", p, "archive"),
    ).toThrow("Arquivamento bloqueado");
    const unused = createSubject(
      x,
      adminActor(1),
      1,
      "Disciplina Sem Vínculos",
    );
    mutateAcademic(x, adminActor(1), "subjects", unused, "archive");
    expect(
      (
        x
          .prepare("SELECT archived_at FROM subjects WHERE id=?")
          .get(unused) as { archived_at: number }
      ).archived_at,
    ).toBeGreaterThan(0);
    mutateAcademic(x, adminActor(1), "subjects", unused, "reactivate");
    replaceSchedule(x, adminActor(1), off, [
      { weekday: 1, start: 480, end: 540, locationId: loc },
      { weekday: 3, start: 600, end: 660, locationId: loc },
    ]);
    expect(
      (
        x
          .prepare("SELECT count(*) n FROM schedule_slots WHERE offering_id=?")
          .get(off) as { n: number }
      ).n,
    ).toBe(2);
    expect(() =>
      replaceSchedule(x, adminActor(1), off, [
        { weekday: 1, start: 480, end: 540, locationId: loc },
        { weekday: 1, start: 530, end: 600, locationId: loc },
      ]),
    ).toThrow("sobrepostos");
  });
  it("administra contas sem revelar senha, revoga sessões e importa CSV de forma atômica", async () => {
    const x = fixture();
    const id = await createV2User(
      x,
      adminActor(1),
      "new.fake",
      "Novo Fictício",
      "Temporary!1234",
    );
    expect(
      (
        x.prepare("SELECT password_hash FROM users WHERE id=?").get(id) as {
          password_hash: string;
        }
      ).password_hash,
    ).not.toContain("Temporary!1234");
    const token = (await authenticateUserV2(x, "new.fake", "Temporary!1234"))
      ?.token;
    expect(token).toBeTruthy();
    editV2User(x, adminActor(1), id, "Novo Nome", false);
    expect(sessionUserV2(x, token)).toBeNull();
    editV2User(x, adminActor(1), id, "Novo Nome", true);
    const bad = previewUsersCsv(
      x,
      adminActor(1),
      "login,nome\na.fake,Alice Fictícia\na.fake,Repetida",
    );
    expect(bad.errors).toHaveLength(1);
    await expect(
      applyUsersCsv(
        x,
        adminActor(1),
        "login,nome\na.fake,Alice Fictícia\na.fake,Repetida",
        bad.fingerprint,
      ),
    ).rejects.toThrow();
    expect(
      x.prepare("SELECT 1 FROM users WHERE login='a.fake'").get(),
    ).toBeUndefined();
    const csv = "login,nome\na.fake,Alice Fictícia\nb.fake,Bob Fictício";
    const good = previewUsersCsv(x, adminActor(1), csv);
    const credentials = await applyUsersCsv(
      x,
      adminActor(1),
      csv,
      good.fingerprint,
    );
    expect(credentials).toHaveLength(2);
    expect(
      await authenticateUserV2(x, "a.fake", credentials[0].temporaryPassword),
    ).not.toBeNull();
  });
  it("transiciona atomicamente, preserva histórico, cria novo contexto e novas matrículas", () => {
    const x = fixture();
    const before = previewTransition(x, adminActor(1), 2);
    expect(before.previous?.period).toBe("2030.1");
    expect(before.target.semester).toBe(2);
    expect(before.offerings.map((o) => o.id)).toEqual([3]);
    expect(() => activateTransition(x, adminActor(1), 2, "wrong")).toThrow(
      "confirmação",
    );
    activateTransition(x, adminActor(1), 2, "ATIVAR 2030.2");
    expect(
      (
        x.prepare("SELECT state FROM cohort_periods WHERE id=1").get() as {
          state: string;
        }
      ).state,
    ).toBe("completed");
    expect(
      (
        x.prepare("SELECT state FROM cohort_periods WHERE id=2").get() as {
          state: string;
        }
      ).state,
    ).toBe("active");
    expect(
      (
        x
          .prepare(
            "SELECT count(*) n FROM user_academic_contexts WHERE cohort_period_id=2 AND current=1",
          )
          .get() as { n: number }
      ).n,
    ).toBe(2);
    expect(
      (
        x
          .prepare("SELECT count(*) n FROM enrollments WHERE offering_id=3")
          .get() as { n: number }
      ).n,
    ).toBe(2);
    expect(
      (
        x
          .prepare("SELECT count(*) n FROM schedule_slots WHERE offering_id=1")
          .get() as { n: number }
      ).n,
    ).toBe(1);
    expect(
      (
        x
          .prepare(
            "SELECT count(*) n FROM user_classroom_mappings WHERE offering_id=3",
          )
          .get() as { n: number }
      ).n,
    ).toBe(0);
    expect(() =>
      activateTransition(x, adminActor(1), 2, "ATIVAR 2030.2"),
    ).toThrow("preparado");
    expect(x.pragma("foreign_key_check")).toEqual([]);
  });
  it("bloqueia choque de sala e preserva oferta compartilhada durante transição", () => {
    const x = fixture();
    expect(() =>
      replaceSchedule(x, adminActor(1), 2, [
        { weekday: 1, start: 500, end: 550, locationId: 1 },
      ]),
    ).toThrow("Sala já usada");
    const other = createCohort(x, adminActor(1), {
      programId: 1,
      curriculumId: 1,
      shiftId: 1,
      code: "SHARED",
      name: "Turma Compartilhada",
    });
    const cp = createCohortPeriod(x, adminActor(1), other, 1, 1);
    x.prepare("UPDATE cohort_periods SET state='active' WHERE id=?").run(cp);
    addOfferingCohort(x, adminActor(1), 1, other);
    activateTransition(x, adminActor(1), 2, "ATIVAR 2030.2");
    expect(
      (
        x.prepare("SELECT state FROM offerings WHERE id=1").get() as {
          state: string;
        }
      ).state,
    ).toBe("active");
    expect(() => addOfferingCohort(x, adminActor(1), 2, other)).toThrow(
      "mismatch",
    );
  });
  it("pré-visualiza lote de matrículas, aplica tudo e permite retirada reversível", () => {
    const x = fixture();
    const preview = previewCohortEnrollment(x, adminActor(1), 1, 3);
    expect(preview.total).toBe(2);
    expect(preview.pending).toBe(1);
    expect(() => enrollCohort(x, adminActor(1), 1, 3, "MATRICULAR 2")).toThrow(
      "Confirmação",
    );
    enrollCohort(x, adminActor(1), 1, 3, "MATRICULAR 1");
    const enrollment = x
      .prepare("SELECT id FROM enrollments WHERE user_id=4 AND offering_id=3")
      .get() as { id: number };
    expect(enrollment.id).toBeGreaterThan(0);
    withdrawEnrollment(x, adminActor(1), enrollment.id);
    expect(
      (
        x
          .prepare("SELECT withdrawn_at FROM enrollments WHERE id=?")
          .get(enrollment.id) as { withdrawn_at: number }
      ).withdrawn_at,
    ).toBeGreaterThan(0);
    expect(previewCohortEnrollment(x, adminActor(1), 1, 3).pending).toBe(1);
    enrollCohort(x, adminActor(1), 1, 3, "MATRICULAR 1");
    expect(
      (
        x
          .prepare("SELECT withdrawn_at FROM enrollments WHERE id=?")
          .get(enrollment.id) as { withdrawn_at: null }
      ).withdrawn_at,
    ).toBeNull();
  });
  it("edita cadastros com autorização e recusa mudança do período histórico", () => {
    const x = fixture();
    editAcademicDetails(x, adminActor(1), "programs", 1, {
      name: "Curso Renomeado",
      code: "NEW",
    });
    expect(
      (
        x.prepare("SELECT code FROM programs WHERE id=1").get() as {
          code: string;
        }
      ).code,
    ).toBe("NEW");
    expect(() =>
      editAcademicDetails(x, userActor(2), "programs", 2, {
        name: "Intrusão",
        code: "NO",
      }),
    ).toThrow("Sem permissão");
    expect(() =>
      editAcademicDetails(x, adminActor(1), "academic_periods", 1, {
        label: "Alterado",
        startsOn: "2030-01-01",
        endsOn: "2030-06-01",
      }),
    ).toThrow("histórico");
  });
  it("limita tentativas de senha por login", async () => {
    const x = db();
    const login = "lock.fake",
      password = "DemoPassword!123";
    await bootstrapV2(x, {
      login,
      name: "Admin Demo",
      password,
      institution: "Instituto Falso",
      program: "ADS",
      code: "ADS",
      shift: "Manhã",
      cohort: "Turma Demo",
      period: "2030.1",
      startsOn: "2030-02-01",
      endsOn: "2030-06-30",
      semesters: 2,
    });
    for (let i = 0; i < 5; i++)
      expect(await authenticateAdminV2(x, login, "wrong-password")).toBeNull();
    expect(await authenticateAdminV2(x, login, password)).toBeNull();
  });
  it("nega matrícula fora de curso e registra audit sem conteúdo privado", () => {
    const x = fixture();
    expect(() => enrollV2(x, userActor(2), 3, 4)).toThrow("Sem permissão");
    enrollV2(x, adminActor(1), 4, 1);
    expect(
      (
        x
          .prepare(
            "SELECT count(*) n FROM admin_audit_events WHERE action='enrollment.create'",
          )
          .get() as { n: number }
      ).n,
    ).toBe(1);
    expect(() =>
      mutateAcademic(x, userActor(2), "subjects", 1, "archive"),
    ).toThrow();
  });
});
