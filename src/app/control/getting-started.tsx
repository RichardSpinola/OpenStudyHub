import Link from "next/link";
import type { V2Database } from "@/lib/v2/database";
import { UiCopy } from "@/components/ui-language-provider";
export function GettingStarted({
  db,
  institutionId,
  programId,
}: {
  db: V2Database;
  institutionId: number;
  programId?: number;
}) {
  const course = (
    programId
      ? db
          .prepare(
            "SELECT id,name FROM programs WHERE id=? AND institution_id=?",
          )
          .get(programId, institutionId)
      : db
          .prepare(
            "SELECT id,name FROM programs WHERE institution_id=? AND archived_at IS NULL ORDER BY id LIMIT 1",
          )
          .get(institutionId)
  ) as { id: number; name: string } | undefined;
  const pid = course?.id ?? 0,
    base = `/control/institutions/${institutionId}`;
  const scalar = (sql: string, ...params: number[]) =>
    (db.prepare(sql).get(...params) as { n: number }).n;
  const offers = pid
    ? scalar(
        "SELECT count(*) n FROM offerings WHERE program_id=? AND archived_at IS NULL",
        pid,
      )
    : 0;
  const scheduled = pid
    ? scalar(
        "SELECT count(*) n FROM schedule_slots s JOIN offerings o ON o.id=s.offering_id WHERE o.program_id=? AND o.archived_at IS NULL",
        pid,
      )
    : 0;
  const enrolled = pid
    ? scalar(
        "SELECT count(*) n FROM enrollments e JOIN offerings o ON o.id=e.offering_id WHERE o.program_id=? AND e.withdrawn_at IS NULL",
        pid,
      )
    : 0;
  const cohortCount = pid
    ? scalar(
        "SELECT count(*) n FROM cohorts WHERE program_id=? AND archived_at IS NULL",
        pid,
      )
    : 0;
  const institution = (
    db
      .prepare("SELECT name FROM institutions WHERE id=?")
      .get(institutionId) as { name: string }
  ).name;
  const curricula = pid
    ? scalar(
        "SELECT count(*) n FROM curricula WHERE program_id=? AND archived_at IS NULL",
        pid,
      )
    : 0;
  const steps = [
    {
      name: "1. Curso e turma",
      text: "Defina os semestres do curso e organize a turma de estudantes.",
      done: !!pid && cohortCount > 0,
      href: pid
        ? `${base}/courses/${pid}?section=${curricula ? "cohorts" : "curriculum"}`
        : `${base}?area=courses`,
    },
    {
      name: "2. Disciplinas do período",
      text: "Escolha quais disciplinas terão aulas neste período.",
      done: offers > 0,
      href: pid
        ? `${base}/courses/${pid}?section=offerings`
        : `${base}?area=courses`,
    },
    {
      name: "3. Horários das aulas",
      text: "Defina dias, horários e salas para aparecerem no App.",
      done: scheduled > 0,
      href: pid
        ? `${base}/courses/${pid}?section=schedule`
        : `${base}?area=courses`,
    },
    {
      name: "4. Contas e matrículas",
      text: "Crie as contas e matricule os estudantes nas disciplinas.",
      done: enrolled > 0,
      href: pid
        ? `${base}/courses/${pid}?section=enrollments`
        : "/control/users",
    },
  ];
  if (steps.every((s) => s.done)) return null;
  return (
    <section className="admin-start-guide">
      <header>
        <h2>
          <UiCopy
            pt="Prepare o acesso dos estudantes"
            en="Prepare student access"
          />
        </h2>
        <strong className="admin-guide-context">
          {institution}
          {course ? ` · ${course.name}` : ""}
        </strong>
        <p>
          <UiCopy
            pt="Siga a sequência. Seus cadastros continuam disponíveis nas áreas abaixo."
            en="Follow the sequence. Your records remain available in the sections below."
          />
        </p>
      </header>
      <ol>
        {steps.map((s) => (
          <li key={s.name} data-done={s.done}>
            <Link href={s.href}>
              <strong>
                {s.done ? "✓ " : ""}
                {s.name}
              </strong>
              <span>{s.text}</span>
              <span>{s.done ? "Revisar →" : "Configurar →"}</span>
            </Link>
          </li>
        ))}
      </ol>
    </section>
  );
}
