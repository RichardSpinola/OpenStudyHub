import { EventForm } from "./event-form";
import Link from "next/link";
import type { Actor } from "@/lib/v2/actor";
import type { V2Database } from "@/lib/v2/database";
import { isAdmin, canManage, type Scope } from "@/lib/v2/access";
import { eventSelect, type AcademicEvent } from "@/lib/v2/academic-events";
import { academicDateTimeInput } from "@/lib/academic-clock";
import { getUiLanguage } from "@/lib/ui-language";
import { controlAction } from "./actions";
import { AdminActionPanel } from "./admin-action-panel";
import { HiddenContext } from "./ui";
export function EventsPanel({
  db,
  actor,
  institutionId,
  programId,
  returnTo,
}: {
  db: V2Database;
  actor: Actor;
  institutionId: number;
  programId?: number;
  returnTo: string;
}) {
  const tr = (pt: string, en: string) => (getUiLanguage() === "en" ? en : pt);
  const zone =
    (
      db
        .prepare(
          "SELECT time_zone z FROM institution_timezones WHERE institution_id=?",
        )
        .get(institutionId) as { z: string } | undefined
    )?.z ?? "America/Bahia";
  const targets: Array<{ value: string; name: string; scope: Scope }> = [];
  if (!programId)
    targets.push({
      value: "institution",
      name: tr("Toda a instituição", "Entire institution"),
      scope: { kind: "institution", id: institutionId },
    });
  for (const r of db
    .prepare(
      "SELECT id,name FROM programs WHERE institution_id=? AND archived_at IS NULL AND (? IS NULL OR id=?)",
    )
    .all(institutionId, programId ?? null, programId ?? null) as Array<{
    id: number;
    name: string;
  }>)
    targets.push({
      value: "program:" + r.id,
      name: tr("Curso: ", "Course: ") + r.name,
      scope: { kind: "program", id: r.id },
    });
  for (const r of db
    .prepare(
      "SELECT c.id,p.name || ' / ' || c.name name FROM cohorts c JOIN programs p ON p.id=c.program_id WHERE p.institution_id=? AND c.archived_at IS NULL AND p.archived_at IS NULL AND (? IS NULL OR p.id=?)",
    )
    .all(institutionId, programId ?? null, programId ?? null) as Array<{
    id: number;
    name: string;
  }>)
    targets.push({
      value: "cohort:" + r.id,
      name: tr("Turma: ", "Cohort: ") + r.name,
      scope: { kind: "cohort", id: r.id },
    });
  for (const r of db
    .prepare(
      "SELECT o.id,p.name || ' / ' || s.name || ' · ' || ap.label || coalesce(' · ' || nullif(o.class_group,''),'') || coalesce(' · ' || sh.name,'') name FROM offerings o JOIN subjects s ON s.id=o.subject_id JOIN programs p ON p.id=o.program_id JOIN academic_periods ap ON ap.id=o.period_id LEFT JOIN shifts sh ON sh.id=o.shift_id WHERE p.institution_id=? AND o.archived_at IS NULL AND p.archived_at IS NULL AND (? IS NULL OR p.id=?)",
    )
    .all(institutionId, programId ?? null, programId ?? null) as Array<{
    id: number;
    name: string;
  }>)
    targets.push({
      value: "offering:" + r.id,
      name: tr("Disciplina: ", "Subject: ") + r.name,
      scope: { kind: "offering", id: r.id },
    });
  const allowed = targets.filter((t) =>
    canManage(db, actor, "manage_schedule", t.scope),
  );
  const events = (
    db
      .prepare(eventSelect + " WHERE institution_id=? ORDER BY starts_at DESC")
      .all(institutionId) as AcademicEvent[]
  ).filter((e) =>
    allowed.some(
      (t) =>
        t.value ===
        (e.offeringId
          ? "offering:" + e.offeringId
          : e.cohortId
            ? "cohort:" + e.cohortId
            : e.programId
              ? "program:" + e.programId
              : "institution"),
    ),
  );
  const form = (e?: AcademicEvent) => (
    <EventForm
      targets={allowed.map((t) => ({ value: t.value, name: t.name }))}
      canExam={isAdmin(db, actor)}
      institutionId={institutionId}
      returnTo={returnTo}
      zone={zone}
      event={
        e
          ? {
              id: e.id,
              title: e.title,
              kind: e.kind,
              audience: e.offeringId
                ? "offering:" + e.offeringId
                : e.cohortId
                  ? "cohort:" + e.cohortId
                  : e.programId
                    ? "program:" + e.programId
                    : "institution",
              start: academicDateTimeInput(new Date(e.startsAt), zone),
              end: academicDateTimeInput(new Date(e.endsAt), zone),
              description: e.description ?? "",
            }
          : undefined
      }
    />
  );
  const card = (e: AcademicEvent) => (
    <article className="admin-event-card" key={e.id}>
      <div>
        <small>
          {e.cancelledAt
            ? tr("Cancelado", "Cancelled")
            : e.kind === "exam"
              ? tr("Modo de prova", "Exam mode")
              : e.kind === "class"
                ? tr("Aula excepcional", "Exceptional class")
                : tr("Evento", "Event")}
        </small>
        <h3>{e.title}</h3>
        <p>
          {academicDateTimeInput(new Date(e.startsAt), zone).replace("T", " ")}{" "}
          → {academicDateTimeInput(new Date(e.endsAt), zone).replace("T", " ")}
        </p>
        <p>
          {
            targets.find(
              (t) =>
                t.value ===
                (e.offeringId
                  ? "offering:" + e.offeringId
                  : e.cohortId
                    ? "cohort:" + e.cohortId
                    : e.programId
                      ? "program:" + e.programId
                      : "institution"),
            )?.name
          }
        </p>
        {e.description && <p>{e.description}</p>}
      </div>
      {!e.cancelledAt && (isAdmin(db, actor) || e.kind !== "exam") && (
        <div className="admin-row-actions">
          <AdminActionPanel
            title={tr("Editar evento", "Edit event") + " " + e.title}
          >
            {form(e)}
          </AdminActionPanel>
          <form action={controlAction}>
            <HiddenContext returnTo={returnTo} intent="eventCancel" id={e.id} />
            <button>{tr("Cancelar evento", "Cancel event")}</button>
          </form>
        </div>
      )}
    </article>
  );
  // Server-rendered snapshot of the event list, recomputed on navigation.
  // eslint-disable-next-line react-hooks/purity
  const now = Date.now();
  const upcoming = events
    .filter((e) => !e.cancelledAt && e.endsAt > now)
    .sort((a, b) => a.startsAt - b.startsAt);
  const historical = events.filter((e) => e.cancelledAt || e.endsAt <= now);
  return (
    <section>
      <div className="admin-section-header">
        <h2>{tr("Eventos e provas", "Events and exams")}</h2>
        {allowed.length > 0 && (
          <AdminActionPanel title={tr("Adicionar evento", "Add event")}>
            {form()}
          </AdminActionPanel>
        )}
      </div>
      <p>
        {tr(
          "Agende por data; não altera a grade semanal permanente.",
          "Schedule by date; the recurring timetable stays intact.",
        )}
      </p>
      <div className="admin-event-list">{upcoming.map(card)}</div>
      {!upcoming.length && (
        <p>
          {tr("Nenhum evento neste contexto.", "No events in this context.")}
        </p>
      )}
      {historical.length > 0 && (
        <details className="admin-secondary-tool">
          <summary>
            Eventos anteriores e cancelados ({historical.length})
          </summary>
          <div className="admin-event-list">{historical.map(card)}</div>
        </details>
      )}
      <Link className="admin-refresh-link" href={returnTo}>
        {tr("Atualizar lista", "Refresh list")}
      </Link>
    </section>
  );
}
