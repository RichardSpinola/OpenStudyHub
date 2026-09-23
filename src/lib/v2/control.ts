import type { Actor } from "./actor";
import type { V2Database } from "./database";
import { canManage, isAdmin, type Capability, type Scope } from "./access";
import { recordAdminAction } from "./audit";

export type ManagedEntity =
  | "institutions"
  | "programs"
  | "shifts"
  | "curricula"
  | "curriculum_semesters"
  | "subjects"
  | "cohorts"
  | "academic_periods"
  | "instructors"
  | "locations"
  | "offerings";
export function requireCapability(
  db: V2Database,
  actor: Actor,
  capability: Capability,
  scope: Scope,
): void {
  if (!canManage(db, actor, capability, scope))
    throw new Error("Sem permissão neste escopo.");
}
export function requireInstanceAdmin(db: V2Database, actor: Actor): void {
  if (!isAdmin(db, actor))
    throw new Error(
      "Somente o administrador da instância pode realizar esta ação.",
    );
}
export function visiblePrograms(
  db: V2Database,
  actor: Actor,
): Array<{ id: number; name: string; institution: string }> {
  const rows = db
    .prepare(
      "SELECT p.id,p.name,i.name institution FROM programs p JOIN institutions i ON i.id=p.institution_id WHERE p.archived_at IS NULL AND i.archived_at IS NULL ORDER BY i.name,p.name",
    )
    .all() as Array<{ id: number; name: string; institution: string }>;
  return rows.filter((r) => {
    if (isAdmin(db, actor)) return true;
    return !!db
      .prepare(
        `SELECT 1 FROM permission_grants g JOIN users u ON u.id=g.user_id WHERE g.user_id=? AND g.revoked_at IS NULL AND u.active=1 AND g.capability IN ('manage_academics','manage_cohort','manage_schedule','manage_enrollments') AND (g.program_id=? OR g.institution_id=(SELECT institution_id FROM programs WHERE id=?) OR g.cohort_id IN (SELECT id FROM cohorts WHERE program_id=?) OR g.offering_id IN (SELECT id FROM offerings WHERE program_id=?)) LIMIT 1`,
      )
      .get(actor.id, r.id, r.id, r.id, r.id);
  });
}
export function entityScope(
  db: V2Database,
  entity: ManagedEntity,
  id: number,
): Scope {
  const q: Record<ManagedEntity, string> = {
    institutions: "SELECT id kind_id FROM institutions WHERE id=?",
    programs: "SELECT id kind_id FROM programs WHERE id=?",
    shifts: "SELECT institution_id kind_id FROM shifts WHERE id=?",
    curricula: "SELECT program_id kind_id FROM curricula WHERE id=?",
    curriculum_semesters:
      "SELECT c.program_id kind_id FROM curriculum_semesters s JOIN curricula c ON c.id=s.curriculum_id WHERE s.id=?",
    subjects: "SELECT institution_id kind_id FROM subjects WHERE id=?",
    cohorts: "SELECT id kind_id FROM cohorts WHERE id=?",
    academic_periods:
      "SELECT institution_id kind_id FROM academic_periods WHERE id=?",
    instructors: "SELECT institution_id kind_id FROM instructors WHERE id=?",
    locations: "SELECT institution_id kind_id FROM locations WHERE id=?",
    offerings: "SELECT id kind_id FROM offerings WHERE id=?",
  };
  const row = db.prepare(q[entity]).get(id) as { kind_id: number } | undefined;
  if (!row) throw new Error("Registro não encontrado.");
  const kind =
    entity === "institutions" || entity === "shifts"
      ? "institution"
      : entity === "programs" ||
          entity === "curricula" ||
          entity === "curriculum_semesters"
        ? "program"
        : entity === "cohorts"
          ? "cohort"
          : entity === "offerings"
            ? "offering"
            : "institution";
  return { kind, id: row.kind_id };
}
const globalEntities: ManagedEntity[] = ["institutions"];
export function mutateAcademic(
  db: V2Database,
  actor: Actor,
  entity: ManagedEntity,
  id: number,
  operation: "archive" | "reactivate" | "delete",
): void {
  const allowed: ManagedEntity[] = [
    "institutions",
    "programs",
    "shifts",
    "curricula",
    "subjects",
    "cohorts",
    "academic_periods",
    "instructors",
    "locations",
    "offerings",
  ];
  if (!allowed.includes(entity)) throw new Error("Entidade inválida.");
  if (!["archive", "reactivate", "delete"].includes(operation))
    throw new Error("Operação inválida.");
  if (globalEntities.includes(entity)) requireInstanceAdmin(db, actor);
  else
    requireCapability(
      db,
      actor,
      entity === "cohorts" ? "manage_cohort" : "manage_academics",
      entityScope(db, entity, id),
    );
  db.transaction(() => {
    if (operation === "archive") {
      const blockers: Partial<Record<ManagedEntity, string>> = {
        institutions:
          "SELECT 1 FROM programs WHERE institution_id=? AND archived_at IS NULL LIMIT 1",
        programs:
          "SELECT 1 FROM cohorts WHERE program_id=? AND archived_at IS NULL LIMIT 1",
        cohorts:
          "SELECT 1 FROM cohort_periods WHERE cohort_id=? AND state='active' LIMIT 1",
        academic_periods:
          "SELECT 1 FROM cohort_periods WHERE period_id=? AND state='active' LIMIT 1",
        offerings:
          "SELECT 1 FROM offerings WHERE id=? AND state='active' LIMIT 1",
      };
      const blocker = blockers[entity];
      if (blocker && db.prepare(blocker).get(id))
        throw new Error(
          "Arquivamento bloqueado enquanto há estrutura ou período ativo. Conclua ou arquive os dependentes primeiro.",
        );
    }
    if (operation === "delete") {
      const deps = db
        .prepare(`SELECT count(*) n FROM ${entity} WHERE id=?`)
        .get(id) as { n: number };
      if (!deps.n) throw new Error("Registro não encontrado.");
      try {
        db.prepare(`DELETE FROM ${entity} WHERE id=?`).run(id);
      } catch {
        throw new Error(
          "Exclusão bloqueada: há histórico ou vínculos. Arquive o registro.",
        );
      }
    } else {
      const value = operation === "archive" ? Date.now() : null;
      if (
        db
          .prepare(`UPDATE ${entity} SET archived_at=? WHERE id=?`)
          .run(value, id).changes !== 1
      )
        throw new Error("Registro não encontrado.");
    }
    recordAdminAction(db, actor, `academic.${operation}`, entity, id);
  })();
}
export type ScheduleInput = {
  weekday: number;
  start: number;
  end: number;
  locationId: number | null;
};
export function replaceSchedule(
  db: V2Database,
  actor: Actor,
  offeringId: number,
  slots: ScheduleInput[],
): void {
  requireCapability(db, actor, "manage_schedule", {
    kind: "offering",
    id: offeringId,
  });
  if (slots.length > 40)
    throw new Error("Limite de 40 blocos por turma da disciplina.");
  for (const s of slots)
    if (
      !Number.isInteger(s.weekday) ||
      s.weekday < 1 ||
      s.weekday > 7 ||
      !Number.isInteger(s.start) ||
      !Number.isInteger(s.end) ||
      s.start < 0 ||
      s.end > 1440 ||
      s.start >= s.end
    )
      throw new Error("Dia ou horário inválido.");
  const ordered = [...slots].sort(
    (a, b) => a.weekday - b.weekday || a.start - b.start,
  );
  for (let i = 1; i < ordered.length; i++)
    if (
      ordered[i].weekday === ordered[i - 1].weekday &&
      ordered[i].start < ordered[i - 1].end
    )
      throw new Error("Há blocos sobrepostos.");
  db.transaction(() => {
    const offering = db
      .prepare(
        "SELECT period_id,instructor_id,program_id FROM offerings WHERE id=? AND archived_at IS NULL",
      )
      .get(offeringId) as
      | { period_id: number; instructor_id: number | null; program_id: number }
      | undefined;
    if (!offering) throw new Error("Turma da disciplina não encontrada.");
    for (const slot of ordered) {
      if (slot.locationId) {
        if (
          !db
            .prepare(
              "SELECT 1 FROM locations l JOIN programs p ON p.institution_id=l.institution_id WHERE l.id=? AND p.id=? AND l.archived_at IS NULL",
            )
            .get(slot.locationId, offering.program_id)
        )
          throw new Error("Sala de outra instituição ou indisponível.");
        const conflict = db
          .prepare(
            "SELECT 1 FROM schedule_slots s JOIN offerings o ON o.id=s.offering_id WHERE s.offering_id!=? AND o.archived_at IS NULL AND o.state!='cancelled' AND o.period_id=? AND s.location_id=? AND s.weekday=? AND s.starts_at_minutes<? AND s.ends_at_minutes>? LIMIT 1",
          )
          .get(
            offeringId,
            offering.period_id,
            slot.locationId,
            slot.weekday,
            slot.end,
            slot.start,
          );
        if (conflict)
          throw new Error(
            "Sala já usada neste horário por outra turma da disciplina.",
          );
      }
      if (offering.instructor_id) {
        const conflict = db
          .prepare(
            "SELECT 1 FROM schedule_slots s JOIN offerings o ON o.id=s.offering_id WHERE s.offering_id!=? AND o.archived_at IS NULL AND o.state!='cancelled' AND o.period_id=? AND o.instructor_id=? AND s.weekday=? AND s.starts_at_minutes<? AND s.ends_at_minutes>? LIMIT 1",
          )
          .get(
            offeringId,
            offering.period_id,
            offering.instructor_id,
            slot.weekday,
            slot.end,
            slot.start,
          );
        if (conflict)
          throw new Error("Professor já possui aula neste horário.");
      }
    }
    db.prepare("DELETE FROM schedule_slots WHERE offering_id=?").run(
      offeringId,
    );
    const insert = db.prepare(
      "INSERT INTO schedule_slots(offering_id,weekday,starts_at_minutes,ends_at_minutes,location_id) VALUES(?,?,?,?,?)",
    );
    for (const s of ordered)
      insert.run(offeringId, s.weekday, s.start, s.end, s.locationId);
    recordAdminAction(db, actor, "schedule.replace", "offering", offeringId);
  })();
}
export function previewTransition(
  db: V2Database,
  actor: Actor,
  targetId: number,
) {
  const target = db
    .prepare(
      `SELECT cp.id,cp.cohort_id cohortId,cp.state,ap.label period,cs.ordinal semester,c.program_id programId,c.name cohort FROM cohort_periods cp JOIN academic_periods ap ON ap.id=cp.period_id JOIN curriculum_semesters cs ON cs.id=cp.semester_id JOIN cohorts c ON c.id=cp.cohort_id WHERE cp.id=?`,
    )
    .get(targetId) as
    | {
        id: number;
        cohortId: number;
        state: string;
        period: string;
        semester: number;
        programId: number;
        cohort: string;
      }
    | undefined;
  if (!target) throw new Error("Período da turma não encontrado.");
  requireCapability(db, actor, "manage_cohort", {
    kind: "cohort",
    id: target.cohortId,
  });
  const previous = db
    .prepare(
      `SELECT cp.id,ap.label period,cs.ordinal semester FROM cohort_periods cp JOIN academic_periods ap ON ap.id=cp.period_id JOIN curriculum_semesters cs ON cs.id=cp.semester_id WHERE cp.cohort_id=? AND cp.state='active'`,
    )
    .get(target.cohortId) as
    { id: number; period: string; semester: number } | undefined;
  const offerings = db
    .prepare(
      `SELECT o.id,s.name subject,o.instructor_id instructorId,(SELECT count(*) FROM schedule_slots sl WHERE sl.offering_id=o.id) slots FROM offerings o JOIN offering_cohorts oc ON oc.offering_id=o.id JOIN subjects s ON s.id=o.subject_id JOIN cohort_periods cp ON cp.period_id=o.period_id WHERE oc.cohort_id=? AND cp.id=? AND o.archived_at IS NULL AND o.state!='cancelled'`,
    )
    .all(target.cohortId, targetId) as Array<{
    id: number;
    subject: string;
    instructorId: number | null;
    slots: number;
  }>;
  const historicalOfferings = previous
    ? (db
        .prepare(
          "SELECT o.id,s.name subject,(SELECT count(*) FROM schedule_slots sl WHERE sl.offering_id=o.id) slots FROM offerings o JOIN offering_cohorts oc ON oc.offering_id=o.id JOIN subjects s ON s.id=o.subject_id JOIN cohort_periods cp ON cp.period_id=o.period_id WHERE oc.cohort_id=? AND cp.id=?",
        )
        .all(target.cohortId, previous.id) as Array<{
        id: number;
        subject: string;
        slots: number;
      }>)
    : [];
  const unlocatedSlots = offerings.length
    ? (
        db
          .prepare(
            `SELECT count(*) n FROM schedule_slots sl WHERE sl.location_id IS NULL AND sl.offering_id IN (${offerings.map(() => "?").join(",")})`,
          )
          .get(...offerings.map((o) => o.id)) as { n: number }
      ).n
    : 0;
  const newEnrollments = previous
    ? offerings.reduce(
        (total, o) =>
          total +
          (
            db
              .prepare(
                "SELECT count(*) n FROM user_academic_contexts x WHERE x.cohort_period_id=? AND NOT EXISTS (SELECT 1 FROM enrollments e WHERE e.user_id=x.user_id AND e.offering_id=?)",
              )
              .get(previous.id, o.id) as { n: number }
          ).n,
        0,
      )
    : 0;
  const students = (
    db
      .prepare(
        "SELECT count(*) n FROM user_academic_contexts WHERE cohort_id=? AND current=1",
      )
      .get(target.cohortId) as { n: number }
  ).n;
  const contextConflicts = previous
    ? (
        db
          .prepare(
            "SELECT count(*) n FROM user_academic_contexts old JOIN user_academic_contexts other ON other.user_id=old.user_id AND other.program_id=old.program_id AND other.current=1 AND other.cohort_id!=old.cohort_id WHERE old.cohort_period_id=?",
          )
          .get(previous.id) as { n: number }
      ).n
    : 0;
  const withdrawnConflicts = previous
    ? offerings.reduce(
        (total, o) =>
          total +
          (
            db
              .prepare(
                "SELECT count(*) n FROM enrollments e JOIN user_academic_contexts x ON x.user_id=e.user_id WHERE x.cohort_period_id=? AND e.offering_id=? AND e.withdrawn_at IS NOT NULL",
              )
              .get(previous.id, o.id) as { n: number }
          ).n,
        0,
      )
    : 0;
  const warnings: string[] = [];
  if (withdrawnConflicts)
    warnings.push(
      `${withdrawnConflicts} matrículas retiradas já existem no destino; resolva-as antes de ativar.`,
    );
  if (contextConflicts)
    warnings.push(
      `${contextConflicts} estudantes possuem outro contexto ativo neste curso; revise antes de ativar.`,
    );
  if (unlocatedSlots)
    warnings.push(`${unlocatedSlots} blocos de horário ainda sem sala.`);
  if (!offerings.length)
    warnings.push(
      "Nenhuma turma da disciplina foi vinculada ao período seguinte.",
    );
  for (const o of offerings) {
    if (!o.instructorId) warnings.push(`${o.subject}: professor não definido.`);
    if (!o.slots) warnings.push(`${o.subject}: horário não definido.`);
  }
  return {
    target,
    previous: previous ?? null,
    offerings,
    students,
    historicalOfferings,
    newEnrollments,
    contextConflicts,
    withdrawnConflicts,
    warnings,
    scheduledBlocks: offerings.reduce((n, o) => n + o.slots, 0),
  };
}
export function activateTransition(
  db: V2Database,
  actor: Actor,
  targetId: number,
  confirmation: string,
): ReturnType<typeof previewTransition> {
  return db.transaction(() => {
    const preview = previewTransition(db, actor, targetId);
    if (preview.target.state !== "planned")
      throw new Error("O período de destino precisa estar preparado.");
    if (confirmation !== `ATIVAR ${preview.target.period}`)
      throw new Error("Digite a confirmação exatamente como apresentada.");
    if (preview.withdrawnConflicts)
      throw new Error(
        "Matrículas retiradas no destino exigem revisão antes da ativação.",
      );
    if (preview.contextConflicts)
      throw new Error(
        "Conflito de contexto de estudantes; revise antes de ativar.",
      );
    if (!preview.offerings.length)
      throw new Error(
        "Crie ao menos uma turma da disciplina antes da ativação.",
      );
    const now = Date.now();
    if (preview.previous) {
      db.prepare(
        "UPDATE cohort_periods SET state='completed',completed_at=? WHERE id=?",
      ).run(now, preview.previous.id);
      db.prepare(
        "UPDATE offerings SET state='completed' WHERE id IN (SELECT o.id FROM offerings o JOIN offering_cohorts oc ON oc.offering_id=o.id JOIN cohort_periods cp ON cp.period_id=o.period_id WHERE oc.cohort_id=? AND cp.id=?) AND state='active' AND NOT EXISTS (SELECT 1 FROM offering_cohorts oc2 JOIN cohort_periods cp2 ON cp2.cohort_id=oc2.cohort_id WHERE oc2.offering_id=offerings.id AND cp2.period_id=offerings.period_id AND cp2.state='active')",
      ).run(preview.target.cohortId, preview.previous.id);
      db.prepare(
        "UPDATE user_academic_contexts SET current=0,completed_at=? WHERE cohort_id=? AND cohort_period_id=? AND current=1",
      ).run(now, preview.target.cohortId, preview.previous.id);
    }
    db.prepare(
      "UPDATE cohort_periods SET state='active',activated_at=? WHERE id=?",
    ).run(now, targetId);
    for (const o of preview.offerings)
      db.prepare(
        "UPDATE offerings SET state='active' WHERE id=? AND state='planned'",
      ).run(o.id);
    if (preview.previous) {
      const members = db
        .prepare(
          "SELECT DISTINCT user_id FROM user_academic_contexts WHERE cohort_period_id=?",
        )
        .all(preview.previous.id) as Array<{ user_id: number }>;
      const context = db.prepare(
        "INSERT OR IGNORE INTO user_academic_contexts(user_id,program_id,cohort_id,cohort_period_id,current,started_at) VALUES(?,?,?,?,1,?)",
      );
      const enrollment = db.prepare(
        "INSERT OR IGNORE INTO enrollments(user_id,offering_id,source) VALUES(?,?,'cohort')",
      );
      for (const member of members) {
        context.run(
          member.user_id,
          preview.target.programId,
          preview.target.cohortId,
          targetId,
          now,
        );
        db.prepare(
          "UPDATE user_academic_contexts SET current=1,started_at=COALESCE(started_at,?) WHERE user_id=? AND cohort_period_id=?",
        ).run(now, member.user_id, targetId);
        for (const o of preview.offerings) enrollment.run(member.user_id, o.id);
      }
    }
    db.prepare(
      "INSERT INTO cohort_transition_events(cohort_id,from_cohort_period_id,to_cohort_period_id,actor_admin_id,actor_user_id) VALUES(?,?,?,?,?)",
    ).run(
      preview.target.cohortId,
      preview.previous?.id ?? null,
      targetId,
      actor.kind === "admin" ? actor.id : null,
      actor.kind === "user" ? actor.id : null,
    );
    recordAdminAction(
      db,
      actor,
      "academic.transition.activate",
      "cohort_period",
      targetId,
    );
    return preview;
  })();
}

export function editAcademicDetails(
  db: V2Database,
  actor: Actor,
  entity: ManagedEntity,
  id: number,
  data: Record<string, string>,
): void {
  const text = (key: string) => String(data[key] ?? "").trim();
  const value = (key: string) => {
    const v = text(key);
    if (!v || v.length > 120) throw new Error(`Campo ${key} inválido.`);
    return v;
  };
  const sqlDate = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s);
  if (entity === "institutions") requireInstanceAdmin(db, actor);
  else
    requireCapability(
      db,
      actor,
      entity === "cohorts" ? "manage_cohort" : "manage_academics",
      entityScope(db, entity, id),
    );
  db.transaction(() => {
    let result;
    switch (entity) {
      case "institutions":
        result = db
          .prepare(
            "UPDATE institutions SET name=? WHERE id=? AND archived_at IS NULL",
          )
          .run(value("name"), id);
        break;
      case "programs":
        result = db
          .prepare(
            "UPDATE programs SET code=?,name=? WHERE id=? AND archived_at IS NULL",
          )
          .run(value("code"), value("name"), id);
        break;
      case "shifts":
        result = db
          .prepare(
            "UPDATE shifts SET code=?,name=? WHERE id=? AND archived_at IS NULL",
          )
          .run(value("code"), value("name"), id);
        break;
      case "curricula":
        result = db
          .prepare(
            "UPDATE curricula SET version=? WHERE id=? AND archived_at IS NULL",
          )
          .run(value("version"), id);
        break;
      case "curriculum_semesters": {
        const ordinal = Number(text("ordinal"));
        if (!Number.isInteger(ordinal) || ordinal < 1 || ordinal > 30)
          throw new Error("Semestre curricular inválido.");
        if (
          db
            .prepare(
              "SELECT 1 FROM curriculum_subjects WHERE semester_id=? UNION SELECT 1 FROM cohort_periods WHERE semester_id=?",
            )
            .get(id, id)
        )
          throw new Error(
            "Semestre curricular já possui vínculos; preserve o histórico.",
          );
        result = db
          .prepare("UPDATE curriculum_semesters SET ordinal=? WHERE id=?")
          .run(ordinal, id);
        break;
      }
      case "subjects":
        result = db
          .prepare(
            "UPDATE subjects SET name=?,code=? WHERE id=? AND archived_at IS NULL",
          )
          .run(value("name"), text("code") || null, id);
        break;
      case "cohorts":
        result = db
          .prepare(
            "UPDATE cohorts SET code=?,name=? WHERE id=? AND archived_at IS NULL",
          )
          .run(value("code"), value("name"), id);
        break;
      case "academic_periods": {
        const start = text("startsOn"),
          end = text("endsOn");
        if (!sqlDate(start) || !sqlDate(end) || start > end)
          throw new Error("Datas do período inválidas.");
        if (
          db
            .prepare(
              "SELECT 1 FROM cohort_periods WHERE period_id=? AND state!='planned'",
            )
            .get(id)
        )
          throw new Error(
            "Período letivo já possui histórico ativo ou concluído.",
          );
        result = db
          .prepare(
            "UPDATE academic_periods SET label=?,starts_on=?,ends_on=? WHERE id=? AND archived_at IS NULL",
          )
          .run(value("label"), start, end, id);
        break;
      }
      case "instructors":
        result = db
          .prepare(
            "UPDATE instructors SET name=? WHERE id=? AND archived_at IS NULL",
          )
          .run(value("name"), id);
        break;
      case "locations":
        result = db
          .prepare(
            "UPDATE locations SET name=?,campus=?,room=? WHERE id=? AND archived_at IS NULL",
          )
          .run(value("name"), text("campus") || null, text("room") || null, id);
        break;
      case "offerings": {
        const instructor = text("instructorId")
          ? Number(text("instructorId"))
          : null;
        const shift = text("shiftId") ? Number(text("shiftId")) : null;
        if (
          (instructor !== null && !Number.isInteger(instructor)) ||
          (shift !== null && !Number.isInteger(shift))
        )
          throw new Error("Professor ou turno inválido.");
        result = db
          .prepare(
            "UPDATE offerings SET instructor_id=?,shift_id=?,class_group=? WHERE id=? AND state='planned' AND archived_at IS NULL",
          )
          .run(instructor, shift, text("classGroup") || null, id);
        break;
      }
      default:
        throw new Error("Edição não suportada.");
    }
    if (result.changes !== 1)
      throw new Error("Registro não encontrado, arquivado ou já histórico.");
    recordAdminAction(db, actor, "academic.edit", entity, id);
  })();
}
