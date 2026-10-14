import { academicClock } from "../academic-clock";
import type { V2Database } from "./database";
import type { Actor } from "./actor";
import { canManage, isAdmin, type Scope } from "./access";
import { recordAdminAction } from "./audit";
export type AcademicEvent = {
  id: number;
  institutionId: number;
  programId: number | null;
  cohortId: number | null;
  offeringId: number | null;
  kind: "event" | "class" | "exam";
  title: string;
  description: string;
  startsAt: number;
  endsAt: number;
  cancelledAt: number | null;
};
export type EventInput = Omit<AcademicEvent, "id" | "cancelledAt">;
export const eventSelect = `SELECT id,institution_id institutionId,program_id programId,cohort_id cohortId,offering_id offeringId,kind,title,description,starts_at startsAt,ends_at endsAt,cancelled_at cancelledAt FROM academic_events_v3`;
function eventScope(e: EventInput): Scope {
  return e.offeringId
    ? { kind: "offering", id: e.offeringId }
    : e.cohortId
      ? { kind: "cohort", id: e.cohortId }
      : e.programId
        ? { kind: "program", id: e.programId }
        : { kind: "institution", id: e.institutionId };
}
function validate(db: V2Database, actor: Actor, e: EventInput) {
  if (
    !["event", "class", "exam"].includes(e.kind) ||
    !e.title.trim() ||
    e.title.length > 180 ||
    e.description.length > 4000 ||
    !Number.isSafeInteger(e.startsAt) ||
    !Number.isSafeInteger(e.endsAt) ||
    e.endsAt <= e.startsAt
  )
    throw new Error(
      "Informe título e datas válidos; o fim deve ser posterior ao início.",
    );
  if (
    [e.programId, e.cohortId, e.offeringId].filter((x) => x !== null).length > 1
  )
    throw new Error("Escolha um único público.");
  if (
    !db
      .prepare("SELECT 1 FROM institutions WHERE id=? AND archived_at IS NULL")
      .get(e.institutionId)
  )
    throw new Error("Instituição indisponível.");
  for (const [id, sql] of [
    [
      e.programId,
      "SELECT 1 FROM programs WHERE id=? AND institution_id=? AND archived_at IS NULL",
    ],
    [
      e.cohortId,
      "SELECT 1 FROM cohorts c JOIN programs p ON p.id=c.program_id WHERE c.id=? AND p.institution_id=? AND c.archived_at IS NULL AND p.archived_at IS NULL",
    ],
    [
      e.offeringId,
      "SELECT 1 FROM offerings o JOIN programs p ON p.id=o.program_id WHERE o.id=? AND p.institution_id=? AND o.archived_at IS NULL AND p.archived_at IS NULL",
    ],
  ] as const)
    if (id !== null && !db.prepare(sql).get(id, e.institutionId))
      throw new Error("O público deve pertencer à instituição selecionada.");
  if (e.kind === "exam" && !isAdmin(db, actor))
    throw new Error("Somente Admin pode configurar modo de prova.");
  if (!canManage(db, actor, "manage_schedule", eventScope(e)))
    throw new Error("Sem permissão para eventos neste público.");
  if (e.kind === "class") {
    const zone =
      (
        db
          .prepare(
            "SELECT time_zone z FROM institution_timezones WHERE institution_id=?",
          )
          .get(e.institutionId) as { z: string } | undefined
      )?.z ?? "America/Bahia";
    if (
      academicClock(new Date(e.startsAt), zone).date !==
      academicClock(new Date(e.endsAt), zone).date
    )
      throw new Error("Cadastre a aula excepcional dentro de um único dia.");
  }
  if (e.kind === "class" && !e.offeringId)
    throw new Error("Uma aula excepcional precisa de uma disciplina/oferta.");
}
export function saveAcademicEvent(
  db: V2Database,
  actor: Actor,
  input: EventInput,
  id?: number,
): number {
  return db.transaction(() => {
    validate(db, actor, input);
    if (id) {
      const old = db.prepare(eventSelect + " WHERE id=?").get(id) as
        AcademicEvent | undefined;
      if (!old) throw new Error("Evento não encontrado.");
      if (old.cancelledAt)
        throw new Error("Evento cancelado. Crie um novo evento.");
      validate(db, actor, old);
      db.prepare(
        "UPDATE academic_events_v3 SET institution_id=?,program_id=?,cohort_id=?,offering_id=?,kind=?,title=?,description=?,starts_at=?,ends_at=? WHERE id=? AND cancelled_at IS NULL",
      ).run(
        input.institutionId,
        input.programId,
        input.cohortId,
        input.offeringId,
        input.kind,
        input.title.trim(),
        input.description.trim(),
        input.startsAt,
        input.endsAt,
        id,
      );
    } else
      id = Number(
        db
          .prepare(
            "INSERT INTO academic_events_v3(institution_id,program_id,cohort_id,offering_id,kind,title,description,starts_at,ends_at) VALUES(?,?,?,?,?,?,?,?,?)",
          )
          .run(
            input.institutionId,
            input.programId,
            input.cohortId,
            input.offeringId,
            input.kind,
            input.title.trim(),
            input.description.trim(),
            input.startsAt,
            input.endsAt,
          ).lastInsertRowid,
      );
    recordAdminAction(db, actor, "event.save", "academic_event", id);
    return id;
  })();
}
export function cancelAcademicEvent(db: V2Database, actor: Actor, id: number) {
  db.transaction(() => {
    const e = db
      .prepare(eventSelect + " WHERE id=? AND cancelled_at IS NULL")
      .get(id) as AcademicEvent | undefined;
    if (!e) throw new Error("Evento indisponível.");
    if (e.kind === "exam" && !isAdmin(db, actor))
      throw new Error("Somente Admin pode cancelar uma prova.");
    if (!canManage(db, actor, "manage_schedule", eventScope(e)))
      throw new Error("Sem permissão neste público.");
    db.prepare("UPDATE academic_events_v3 SET cancelled_at=? WHERE id=?").run(
      Date.now(),
      id,
    );
    recordAdminAction(db, actor, "event.cancel", "academic_event", id);
  })();
}
export function eventAppliesToUser(
  db: V2Database,
  e: AcademicEvent,
  userId: number,
): boolean {
  if (!db.prepare("SELECT 1 FROM users WHERE id=? AND active=1").get(userId))
    return false;
  // Only active academic membership determines audience; grants never enroll someone.
  if (e.cohortId)
    return !!db
      .prepare(
        `SELECT 1 FROM user_academic_contexts c JOIN cohorts h ON h.id=c.cohort_id JOIN programs p ON p.id=h.program_id WHERE c.user_id=? AND c.cohort_id=? AND c.current=1 AND h.archived_at IS NULL AND p.archived_at IS NULL`,
      )
      .get(userId, e.cohortId);
  if (
    !e.offeringId &&
    db
      .prepare(
        `SELECT 1 FROM user_academic_contexts c JOIN cohorts h ON h.id=c.cohort_id JOIN programs p ON p.id=c.program_id WHERE c.user_id=? AND c.current=1 AND h.archived_at IS NULL AND p.archived_at IS NULL AND p.institution_id=? AND (? IS NULL OR p.id=?)`,
      )
      .get(userId, e.institutionId, e.programId, e.programId)
  )
    return true;
  return !!db
    .prepare(
      `SELECT 1 FROM enrollments en JOIN offerings o ON o.id=en.offering_id JOIN programs p ON p.id=o.program_id WHERE en.user_id=? AND en.withdrawn_at IS NULL AND o.archived_at IS NULL AND o.state!='cancelled' AND p.archived_at IS NULL AND p.institution_id=? AND (? IS NULL OR o.program_id=?) AND (? IS NULL OR o.id=?)`,
    )
    .get(
      userId,
      e.institutionId,
      e.programId,
      e.programId,
      e.offeringId,
      e.offeringId,
    );
}
export function userAcademicEvents(
  db: V2Database,
  userId: number,
  from = Date.now(),
  until = from + 7 * 86400000,
) {
  return (
    db
      .prepare(
        eventSelect +
          " WHERE cancelled_at IS NULL AND ends_at>? AND starts_at<=? ORDER BY starts_at,id",
      )
      .all(from, until) as AcademicEvent[]
  ).filter((e) => eventAppliesToUser(db, e, userId));
}
export function activeExam(
  db: V2Database,
  userId: number,
  now = Date.now(),
): AcademicEvent | null {
  return (
    (
      db
        .prepare(
          eventSelect +
            " WHERE kind='exam' AND cancelled_at IS NULL AND starts_at<=? AND ends_at>? ORDER BY ends_at DESC",
        )
        .all(now, now) as AcademicEvent[]
    ).find((e) => eventAppliesToUser(db, e, userId)) ?? null
  );
}
export { examRestrictedPath } from "../exam-paths";
