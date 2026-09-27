"use server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import {
  bootstrapV2,
  authenticateAdminV2,
  isSetupPending,
  revokeAdminSessionV2,
  revokeUserSessionV2,
  setPasswordV2,
  setAdminPasswordV2,
  sessionUserV2,
} from "@/lib/v2/auth";
import {
  ADMIN_COOKIE,
  withV2DbAsync,
  currentAdminV2,
  currentUserV2,
  readUserSessionTokenV2,
  writeUserSessionV2,
  clearUserSessionV2,
} from "@/lib/v2/runtime";
import { authenticateNormal } from "@/lib/v2/identity-bridge";
import { clearSessionCookie } from "@/lib/session-cookie";
import {
  clearV2SessionCookie,
  writeV2SessionCookie,
} from "@/lib/v2/session-cookie";
import { uiLanguageSchema, updateUiLanguage } from "@/lib/ui-language";
import {
  createInstitution,
  createProgram,
  updateProgramDetails,
  createShift,
  createCurriculum,
  createCurriculumSemester,
  createSubject,
  createCurriculumMapping,
  createCohort,
  createAcademicPeriod,
  createCohortPeriod,
  createInstructor,
  createLocation,
  createOffering,
  addOfferingCohort,
  renameAcademic,
  type AcademicEntity,
} from "@/lib/v2/academics";
import {
  grant,
  revokeGrant,
  type Capability,
  type Scope,
} from "@/lib/v2/access";
import {
  mutateAcademic,
  editAcademicDetails,
  replaceSchedule,
  activateTransition,
  type ManagedEntity,
} from "@/lib/v2/control";
import {
  createV2User,
  editV2User,
  deleteV2User,
  enrollV2,
  withdrawEnrollment,
  enrollCohort,
  previewUsersCsv,
  applyUsersCsv,
} from "@/lib/v2/users";
import {
  linkLegacyOffering,
  offeringCoverLimitBytes,
  saveOfferingCover,
  removeOfferingCover,
} from "@/lib/v2/offering-covers";

const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
const num = (f: FormData, k: string) => Number(str(f, k));
function path(f: FormData) {
  const value = str(f, "returnTo");
  return /^\/(control|gestao)(\/|\?|$)/.test(value) ? value : "/control";
}
function messagePath(base: string, type: "ok" | "error", message: string) {
  const url = new URL(base, "http://local.invalid");
  url.searchParams.set(type, message.slice(0, 220));
  return url.pathname + url.search;
}

export async function setupAction(f: FormData): Promise<void> {
  let error = "";
  try {
    const language = uiLanguageSchema.parse(str(f, "language"));
    await withV2DbAsync(async (db) => {
      if (!isSetupPending(db)) throw new Error("Setup já concluído.");
      await bootstrapV2(db, {
        login: str(f, "login"),
        name: str(f, "name"),
        password: str(f, "password"),
        institution: str(f, "institution"),
        program: str(f, "program"),
        code: str(f, "code"),
        shift: str(f, "shift"),
        cohort: str(f, "cohort"),
        period: str(f, "period"),
        startsOn: str(f, "startsOn"),
        endsOn: str(f, "endsOn"),
        semesters: num(f, "semesters"),
        subject: str(f, "subject"),
        instructor: str(f, "instructor"),
        location: str(f, "location"),
      });
    });
    updateUiLanguage(language);
  } catch (e) {
    error = e instanceof Error ? e.message : "Erro no setup.";
  }
  redirect(
    error
      ? messagePath("/control/setup", "error", error)
      : messagePath(
          "/control/login",
          "ok",
          str(f, "language") === "en"
            ? "Setup complete. Sign in with your admin account."
            : "Setup concluído. Entre com sua conta administrativa.",
        ),
  );
}
export async function loginAction(f: FormData): Promise<void> {
  let ok = false;
  try {
    const result = await withV2DbAsync((db) =>
      authenticateAdminV2(db, str(f, "login"), str(f, "password")),
    );
    if (result) {
      await writeV2SessionCookie(ADMIN_COOKIE, result.token);
      ok = true;
    }
  } catch {}
  redirect(
    ok
      ? "/control"
      : messagePath(
          "/control/login",
          "error",
          "Credenciais inválidas ou acesso desativado.",
        ),
  );
}
export async function userLoginAction(f: FormData): Promise<void> {
  let result: { token: string; mustChangePassword: boolean } | null = null;
  try {
    result = await withV2DbAsync(async (db) => {
      const authenticated = await authenticateNormal(
        db,
        str(f, "login"),
        str(f, "password"),
      );
      if (!authenticated) return null;
      const user = sessionUserV2(db, authenticated.token);
      return {
        token: authenticated.token,
        mustChangePassword:
          user?.id === authenticated.id && user.mustChangePassword,
      };
    });
  } catch {}
  if (result) {
    await writeUserSessionV2(result.token);
    await clearSessionCookie();
  }
  redirect(
    result
      ? result.mustChangePassword
        ? "/gestao/password"
        : "/gestao"
      : messagePath(
          "/gestao/login",
          "error",
          "Credenciais inválidas ou acesso desativado.",
        ),
  );
}
export async function logoutAdminAction(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(ADMIN_COOKIE)?.value;
  try {
    await withV2DbAsync(async (db) => revokeAdminSessionV2(db, token));
  } catch {}
  await clearV2SessionCookie(ADMIN_COOKIE);
  redirect("/control/login");
}
export async function logoutUserAction(): Promise<void> {
  const token = await readUserSessionTokenV2();
  try {
    await withV2DbAsync(async (db) => revokeUserSessionV2(db, token));
  } catch {}
  await clearUserSessionV2();
  await clearSessionCookie();
  redirect("/gestao/login");
}

export async function controlAction(f: FormData): Promise<void> {
  const returnTo = path(f);
  let error = "";
  let ok = "Alteração salva.";
  try {
    await withV2DbAsync(async (db) => {
      const admin = await currentAdminV2(db);
      const actor = returnTo.startsWith("/control")
        ? admin
        : ((await currentUserV2(db)) ?? admin);
      if (!actor) throw new Error("Sessão expirada. Entre novamente.");
      const intent = str(f, "intent"),
        id = num(f, "id");
      if (actor.mustChangePassword && intent !== "changeOwnPassword")
        throw new Error("Troque sua senha temporária antes de continuar.");
      switch (intent) {
        case "institution":
          createInstitution(db, actor, str(f, "name"));
          break;
        case "program":
          createProgram(
            db,
            actor,
            num(f, "institutionId"),
            str(f, "code"),
            str(f, "name"),
            str(f, "shortName"),
          );
          break;
        case "programDetails":
          updateProgramDetails(
            db,
            actor,
            id,
            str(f, "name"),
            str(f, "shortName"),
          );
          break;
        case "shift":
          createShift(
            db,
            actor,
            num(f, "institutionId"),
            str(f, "code"),
            str(f, "name"),
          );
          break;
        case "curriculum":
          createCurriculum(db, actor, num(f, "programId"), str(f, "version"));
          break;
        case "semester":
          createCurriculumSemester(
            db,
            actor,
            num(f, "curriculumId"),
            num(f, "ordinal"),
          );
          break;
        case "subject":
          createSubject(
            db,
            actor,
            num(f, "institutionId"),
            str(f, "name"),
            str(f, "code") || null,
          );
          break;
        case "mapping":
          createCurriculumMapping(
            db,
            actor,
            num(f, "semesterId"),
            num(f, "subjectId"),
          );
          break;
        case "cohort":
          createCohort(db, actor, {
            programId: num(f, "programId"),
            curriculumId: num(f, "curriculumId"),
            shiftId: num(f, "shiftId"),
            code: str(f, "code"),
            name: str(f, "name"),
          });
          break;
        case "period":
          createAcademicPeriod(
            db,
            actor,
            num(f, "institutionId"),
            str(f, "label"),
            str(f, "startsOn"),
            str(f, "endsOn"),
          );
          break;
        case "cohortPeriod":
          createCohortPeriod(
            db,
            actor,
            num(f, "cohortId"),
            num(f, "periodId"),
            num(f, "semesterId"),
          );
          break;
        case "instructor":
          createInstructor(db, actor, num(f, "institutionId"), str(f, "name"));
          break;
        case "location":
          createLocation(
            db,
            actor,
            num(f, "institutionId"),
            str(f, "name"),
            str(f, "campus") || null,
            str(f, "room") || null,
          );
          break;
        case "offering":
          createOffering(db, actor, {
            subjectId: num(f, "subjectId"),
            programId: num(f, "programId"),
            periodId: num(f, "periodId"),
            instructorId: num(f, "instructorId") || undefined,
            shiftId: num(f, "shiftId") || undefined,
            curriculumSubjectId: num(f, "mappingId") || undefined,
            classGroup: str(f, "classGroup") || undefined,
          });
          break;
        case "offeringCohort":
          addOfferingCohort(
            db,
            actor,
            num(f, "offeringId"),
            num(f, "cohortId"),
          );
          break;
        case "legacyOfferingLink":
          linkLegacyOffering(
            db,
            actor,
            num(f, "offeringId"),
            num(f, "legacyOfferingId"),
          );
          ok = "Ligação com a turma V1 confirmada.";
          break;
        case "offeringCover": {
          const file = f.get("cover");
          if (!(file instanceof File) || file.size > offeringCoverLimitBytes)
            throw new Error("Envie uma imagem de até 5 MiB.");
          await saveOfferingCover(
            db,
            actor,
            num(f, "offeringId"),
            Buffer.from(await file.arrayBuffer()),
          );
          ok = "Capa da disciplina salva.";
          break;
        }
        case "offeringCoverRemove":
          await removeOfferingCover(db, actor, num(f, "offeringId"));
          ok = "Capa removida. O visual padrão foi restaurado.";
          break;
        case "rename":
          renameAcademic(
            db,
            actor,
            str(f, "entity") as AcademicEntity,
            id,
            str(f, "name"),
          );
          break;
        case "edit":
          editAcademicDetails(
            db,
            actor,
            str(f, "entity") as ManagedEntity,
            id,
            Object.fromEntries(
              [...f.entries()]
                .filter(([key]) =>
                  [
                    "name",
                    "code",
                    "version",
                    "ordinal",
                    "label",
                    "startsOn",
                    "endsOn",
                    "campus",
                    "room",
                    "instructorId",
                    "shiftId",
                    "classGroup",
                  ].includes(key),
                )
                .map(([key, value]) => [key, String(value)]),
            ),
          );
          break;
        case "lifecycle":
          mutateAcademic(
            db,
            actor,
            str(f, "entity") as ManagedEntity,
            id,
            str(f, "operation") as "archive" | "reactivate" | "delete",
          );
          break;
        case "grant":
          grant(
            db,
            actor,
            num(f, "userId"),
            str(f, "capability") as Capability,
            {
              kind: str(f, "scopeKind") as Scope["kind"],
              id: num(f, "scopeId"),
            },
          );
          break;
        case "revoke":
          revokeGrant(db, actor, id);
          break;
        case "enroll":
          enrollV2(db, actor, num(f, "userId"), num(f, "offeringId"));
          break;
        case "withdraw":
          withdrawEnrollment(db, actor, id);
          break;
        case "enrollCohort":
          enrollCohort(
            db,
            actor,
            num(f, "cohortId"),
            num(f, "offeringId"),
            str(f, "confirmation"),
          );
          ok = "Matrícula em lote aplicada integralmente.";
          break;
        case "user":
          await createV2User(
            db,
            actor,
            str(f, "login"),
            str(f, "name"),
            str(f, "password"),
          );
          break;
        case "editUser":
          editV2User(db, actor, id, str(f, "name"), str(f, "active") === "1");
          break;
        case "deleteUser":
          deleteV2User(db, actor, id, str(f, "confirmation"));
          ok = "Conta sem vínculos excluída.";
          break;
        case "password":
          if (actor.kind !== "admin") throw new Error("Admin required");
          await setPasswordV2(db, actor, id, str(f, "password"), true);
          ok =
            "Senha redefinida. Compartilhe a senha temporária por um canal seguro.";
          break;
        case "changeOwnPassword":
          if (!actor.mustChangePassword)
            throw new Error("Troca de senha temporária não pendente.");
          if (actor.kind === "admin")
            await setAdminPasswordV2(db, actor, str(f, "password"));
          else
            await setPasswordV2(db, actor, actor.id, str(f, "password"), false);
          ok = "Senha alterada. Entre novamente.";
          break;
        case "schedule": {
          const raw = str(f, "slots");
          const slots = JSON.parse(raw) as Array<{
            weekday: number;
            start: number;
            end: number;
            locationId: number | null;
          }>;
          if (!Array.isArray(slots))
            throw new Error("Conjunto de horários inválido.");
          replaceSchedule(db, actor, num(f, "offeringId"), slots);
          break;
        }
        case "transition":
          activateTransition(
            db,
            actor,
            num(f, "targetId"),
            str(f, "confirmation"),
          );
          ok = "Novo período ativado; histórico preservado.";
          break;
        default:
          throw new Error("Ação desconhecida.");
      }
    });
  } catch (e) {
    error = e instanceof Error ? e.message : "Operação não concluída.";
  }
  revalidatePath("/control");
  revalidatePath("/gestao");
  redirect(messagePath(returnTo, error ? "error" : "ok", error || ok));
}

export type CsvState = {
  preview?: ReturnType<typeof previewUsersCsv>;
  csv?: string;
  credentials?: Array<{ login: string; temporaryPassword: string }>;
  error?: string;
};
export async function csvAction(
  _previous: CsvState,
  f: FormData,
): Promise<CsvState> {
  const csv = str(f, "csv"),
    mode = str(f, "mode");
  try {
    return await withV2DbAsync(async (db) => {
      const actor = await currentAdminV2(db);
      if (!actor) throw new Error("Entre novamente.");
      if (mode === "apply") {
        const credentials = await applyUsersCsv(
          db,
          actor,
          csv,
          str(f, "fingerprint"),
        );
        return { credentials };
      }
      return { preview: previewUsersCsv(db, actor, csv), csv };
    });
  } catch (e) {
    return {
      error: e instanceof Error ? e.message : "Erro ao importar CSV.",
      csv,
    };
  }
}
