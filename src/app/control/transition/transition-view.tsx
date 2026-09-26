import { UiCopy } from "@/components/ui-language-provider";
import type { Actor } from "@/lib/v2/actor";
import Link from "next/link";
import type { V2Database } from "@/lib/v2/database";
import { visiblePrograms, previewTransition } from "@/lib/v2/control";
import { canManage } from "@/lib/v2/access";
import { controlAction } from "../actions";
import { ConsoleShell, HiddenContext, Help } from "../ui";
import { getUiLanguage } from "@/lib/ui-language";
import { uiText } from "@/lib/translations";
export function TransitionView({
  db,
  actor,
  name,
  admin,
  programId,
  targetId,
  base,
  message,
  error,
  contextual = false,
}: {
  db: V2Database;
  actor: Actor;
  name: string;
  admin: boolean;
  programId: number;
  targetId: number;
  base: string;
  message?: string;
  error?: string;
  contextual?: boolean;
}) {
  const language = getUiLanguage();
  const tr = (pt: string, en: string) => uiText(language, pt, en);
  const programs = visiblePrograms(db, actor);
  const program = programs.find((p) => p.id === programId) ?? programs[0];
  const pid = program?.id ?? 0;
  const targetsAll = pid
    ? (db
        .prepare(
          "SELECT cp.id,c.id cohortId,c.name cohort,ap.label period,cs.ordinal semester,cp.state FROM cohort_periods cp JOIN cohorts c ON c.id=cp.cohort_id JOIN academic_periods ap ON ap.id=cp.period_id JOIN curriculum_semesters cs ON cs.id=cp.semester_id WHERE c.program_id=? ORDER BY ap.starts_on DESC",
        )
        .all(pid) as Array<{
        id: number;
        cohortId: number;
        cohort: string;
        period: string;
        semester: number;
        state: string;
      }>)
    : [];
  const targets = targetsAll.filter((t) =>
    canManage(db, actor, "manage_cohort", { kind: "cohort", id: t.cohortId }),
  );
  let preview: ReturnType<typeof previewTransition> | null = null;
  let previewError = "";
  if (targetId) {
    try {
      preview = previewTransition(db, actor, targetId);
    } catch (e) {
      previewError =
        e instanceof Error
          ? e.message
          : tr("Prévia indisponível.", "Preview unavailable.");
    }
  }
  const returnTo = contextual
    ? `${base}?target=${targetId || ""}`
    : `${base}?program=${pid}&target=${targetId || ""}`;
  const targetPath = (id: number) =>
    contextual ? `${base}?target=${id}` : `${base}?program=${pid}&target=${id}`;
  return (
    <ConsoleShell
      title={tr("Período e semestre", "Period and semester")}
      kicker={
        admin
          ? tr("Admin · ciclo acadêmico", "Admin · academic cycle")
          : tr("Gestão · ciclo acadêmico", "Management · academic cycle")
      }
      name={name}
      admin={admin}
      active={admin ? "institutions" : undefined}
      message={message}
      error={error || previewError}
    >
      <p>
        <UiCopy
          pt="Prepare as turmas da disciplina no período seguinte, confira o impacto e confirme a ativação. O histórico anterior permanece consultável."
          en="Prepare subject offerings for the next period, review the impact and confirm activation. Previous history remains available."
        />
      </p>
      <Help>
        <UiCopy
          pt="Semestre curricular é a posição no currículo. Período letivo é a janela de aulas. Uma turma da disciplina nova é criada para cada período; a oferta anterior não é reutilizada."
          en="A curriculum semester is a position in the curriculum. An academic period is the class window. A new subject offering is created for each period; the previous offering is not reused."
        />
      </Help>
      {!contextual ? (
        <nav className="v2-tabs" aria-label={tr("Cursos", "Courses")}>
          {programs.map((p) => (
            <Link key={p.id} href={`${base}?program=${p.id}`}>
              {p.name}
            </Link>
          ))}
        </nav>
      ) : null}
      {pid ? (
        <>
          <div className="v2-context">
            <strong>
              <UiCopy pt="Curso:" en="Course:" />
            </strong>{" "}
            {program.name}
          </div>
          <h2>
            <UiCopy pt="Períodos das turmas" en="Cohort periods" />
          </h2>
          <div className="v2-list">
            {targets.map((t) => (
              <div className="v2-row" key={t.id}>
                <span>
                  {t.cohort} · {t.period} · {t.semester}
                  <UiCopy pt="º semestre" en=" semester" /> · {t.state}
                </span>
                {t.state === "planned" ? (
                  <Link href={targetPath(t.id)}>
                    <UiCopy pt="Revisar transição →" en="Review transition →" />
                  </Link>
                ) : null}
              </div>
            ))}
          </div>
          <p>
            <Link
              href={
                admin
                  ? contextual
                    ? base.replace(/\/transition$/, "?section=curriculum")
                    : `/control/academics?program=${pid}&section=curriculum`
                  : `/gestao?program=${pid}&section=curriculum`
              }
            >
              <UiCopy
                pt="Preparar outro período e suas turmas da disciplina →"
                en="Prepare another period and its subject offerings →"
              />
            </Link>
          </p>
          {preview ? (
            <section>
              <h2>
                <UiCopy
                  pt="Prévia antes da ativação"
                  en="Preview before activation"
                />
              </h2>
              <div className="v2-context">
                <strong>
                  <UiCopy pt="Encerrando:" en="Closing:" />
                </strong>{" "}
                {preview.previous
                  ? tr(
                      `${preview.previous.period} · ${preview.previous.semester}º semestre`,
                      `${preview.previous.period} · semester ${preview.previous.semester}`,
                    )
                  : tr("Nenhum período ativo", "No active period")}
                <br />
                <strong>
                  <UiCopy pt="Ativando:" en="Activating:" />
                </strong>{" "}
                {preview.target.period} · {preview.target.semester}
                <UiCopy pt="º semestre" en=" semester" /> ·{" "}
                {preview.target.cohort}
              </div>
              <p>
                {preview.offerings.length}{" "}
                <UiCopy
                  pt="novas turmas da disciplina;"
                  en="new subject offerings;"
                />{" "}
                {preview.students}{" "}
                <UiCopy
                  pt="estudantes no contexto atual;"
                  en="students in the current context;"
                />{" "}
                {preview.newEnrollments}{" "}
                <UiCopy
                  pt="novas matrículas previstas;"
                  en="new enrollments expected;"
                />{" "}
                {preview.scheduledBlocks}{" "}
                <UiCopy
                  pt="blocos de horário no novo período."
                  en="schedule blocks in the new period."
                />
              </p>
              <h3>
                <UiCopy
                  pt="Histórico que será preservado"
                  en="History to preserve"
                />
              </h3>
              <div className="v2-list">
                {preview.historicalOfferings.map((o) => (
                  <div key={o.id} className="v2-row">
                    {o.subject} · {o.slots}{" "}
                    <UiCopy
                      pt="blocos de horário anteriores"
                      en="previous schedule blocks"
                    />
                  </div>
                ))}
              </div>
              <h3>
                <UiCopy
                  pt="Turmas da disciplina novas"
                  en="New subject offerings"
                />
              </h3>
              <div className="v2-list">
                {preview.offerings.map((o) => (
                  <div className="v2-row" key={o.id}>
                    {o.subject} · {o.slots} <UiCopy pt="blocos" en="blocks" />{" "}
                    {o.instructorId
                      ? tr("· professor definido", "· instructor assigned")
                      : tr("· professor pendente", "· instructor pending")}
                  </div>
                ))}
              </div>
              <p>
                <UiCopy
                  pt="As turmas da disciplina e os horários anteriores ficam históricos. Matrículas dos estudantes no contexto atual serão criadas nas ofertas vinculadas à turma; exceções individuais não são copiadas. Mapeamentos Classroom antigos não são copiados."
                  en="Previous subject offerings and schedules become history. Student enrollments in the current context will be created in offerings linked to the cohort; individual exceptions are not copied. Old Classroom mappings are not copied."
                />
              </p>
              {preview.warnings.length ? (
                <div className="v2-message" data-type="error">
                  <strong>
                    <UiCopy pt="Itens para revisão:" en="Items to review:" />
                  </strong>
                  <ul>
                    {preview.warnings.map((w) => (
                      <li key={w}>{w}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
              <form action={controlAction}>
                <HiddenContext
                  returnTo={returnTo}
                  intent="transition"
                  targetId={targetId}
                />
                <label>
                  <UiCopy
                    pt="Confirmação explícita: digite"
                    en="Explicit confirmation: type"
                  />{" "}
                  <strong>ATIVAR {preview.target.period}</strong>
                  <input name="confirmation" autoComplete="off" required />
                </label>
                <div className="v2-actions">
                  <button type="submit" disabled={!preview.offerings.length}>
                    <UiCopy
                      pt="Ativar período e preservar histórico"
                      en="Activate period and preserve history"
                    />
                  </button>
                </div>
              </form>
            </section>
          ) : null}
        </>
      ) : (
        <p>
          <UiCopy
            pt="Nenhum curso dentro do seu escopo."
            en="No courses within your scope."
          />
        </p>
      )}
    </ConsoleShell>
  );
}
