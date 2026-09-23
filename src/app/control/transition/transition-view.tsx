import type { Actor } from "@/lib/v2/actor";
import Link from "next/link";
import type { V2Database } from "@/lib/v2/database";
import { visiblePrograms, previewTransition } from "@/lib/v2/control";
import { canManage } from "@/lib/v2/access";
import { controlAction } from "../actions";
import { ConsoleShell, HiddenContext, Help } from "../ui";
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
}) {
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
      previewError = e instanceof Error ? e.message : "Prévia indisponível.";
    }
  }
  const returnTo = `${base}?program=${pid}&target=${targetId || ""}`;
  return (
    <ConsoleShell
      title="Transição de período"
      kicker={admin ? "Admin · ciclo acadêmico" : "Gestão · ciclo acadêmico"}
      name={name}
      admin={admin}
      message={message}
      error={error || previewError}
    >
      <p>
        Prepare as turmas da disciplina no período seguinte, confira o impacto e
        confirme a ativação. O histórico anterior permanece consultável.
      </p>
      <Help>
        Semestre curricular é a posição no currículo. Período letivo é a janela
        de aulas. Uma turma da disciplina nova é criada para cada período; a
        oferta anterior não é reutilizada.
      </Help>
      <nav className="v2-tabs" aria-label="Cursos">
        {programs.map((p) => (
          <Link key={p.id} href={`${base}?program=${p.id}`}>
            {p.name}
          </Link>
        ))}
      </nav>
      {pid ? (
        <>
          <div className="v2-context">
            <strong>Curso:</strong> {program.name}
          </div>
          <h2>Períodos das turmas</h2>
          <div className="v2-list">
            {targets.map((t) => (
              <div className="v2-row" key={t.id}>
                <span>
                  {t.cohort} · {t.period} · {t.semester}º semestre · {t.state}
                </span>
                {t.state === "planned" ? (
                  <Link href={`${base}?program=${pid}&target=${t.id}`}>
                    Revisar transição →
                  </Link>
                ) : null}
              </div>
            ))}
          </div>
          <p>
            <Link
              href={
                admin
                  ? `/control/academics?program=${pid}&section=curriculum`
                  : `/gestao?program=${pid}&section=curriculum`
              }
            >
              Preparar outro período e suas turmas da disciplina →
            </Link>
          </p>
          {preview ? (
            <section>
              <h2>Prévia antes da ativação</h2>
              <div className="v2-context">
                <strong>Encerrando:</strong>{" "}
                {preview.previous
                  ? `${preview.previous.period} · ${preview.previous.semester}º semestre`
                  : "Nenhum período ativo"}
                <br />
                <strong>Ativando:</strong> {preview.target.period} ·{" "}
                {preview.target.semester}º semestre · {preview.target.cohort}
              </div>
              <p>
                {preview.offerings.length} novas turmas da disciplina;{" "}
                {preview.students} estudantes no contexto atual;{" "}
                {preview.newEnrollments} novas matrículas previstas;{" "}
                {preview.scheduledBlocks} blocos de horário no novo período.
              </p>
              <h3>Histórico que será preservado</h3>
              <div className="v2-list">
                {preview.historicalOfferings.map((o) => (
                  <div key={o.id} className="v2-row">
                    {o.subject} · {o.slots} blocos de horário anteriores
                  </div>
                ))}
              </div>
              <h3>Turmas da disciplina novas</h3>
              <div className="v2-list">
                {preview.offerings.map((o) => (
                  <div className="v2-row" key={o.id}>
                    {o.subject} · {o.slots} blocos{" "}
                    {o.instructorId
                      ? "· professor definido"
                      : "· professor pendente"}
                  </div>
                ))}
              </div>
              <p>
                As turmas da disciplina e os horários anteriores ficam
                históricos. Matrículas dos estudantes no contexto atual serão
                criadas nas ofertas vinculadas à turma; exceções individuais não
                são copiadas. Mapeamentos Classroom antigos não são copiados.
              </p>
              {preview.warnings.length ? (
                <div className="v2-message" data-type="error">
                  <strong>Itens para revisão:</strong>
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
                  Confirmação explícita: digite{" "}
                  <strong>ATIVAR {preview.target.period}</strong>
                  <input name="confirmation" autoComplete="off" required />
                </label>
                <div className="v2-actions">
                  <button type="submit" disabled={!preview.offerings.length}>
                    Ativar período e preservar histórico
                  </button>
                </div>
              </form>
            </section>
          ) : null}
        </>
      ) : (
        <p>Nenhum curso dentro do seu escopo.</p>
      )}
    </ConsoleShell>
  );
}
