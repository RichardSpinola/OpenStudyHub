import { getDatabase, type DatabaseConnection } from "@/lib/db/client";
import type { V2Database } from "./database";
import type { ManagedEntity } from "./control";
import type { Actor } from "./actor";
import { canManage, isAdmin } from "./access";
import { entityScope } from "./control";
export const dependencyLabels: Record<string, string> = {
  programs: "Cursos",
  cohorts: "Turmas",
  curricula: "Currículos",
  curriculum_semesters: "Semestres",
  curriculum_subjects: "Disciplinas do currículo",
  academic_periods: "Períodos",
  cohort_periods: "Períodos das turmas",
  offerings: "Ofertas",
  enrollments: "Matrículas e histórico",
  schedule_slots: "Horários",
  offering_cohorts: "Turmas vinculadas",
  user_academic_contexts: "Contextos de estudantes",
  permission_grants: "Permissões e histórico",
  academic_events_v3: "Eventos e provas",
  offering_covers: "Capas",
  legacy_offering_links: "Vínculos de compatibilidade",
};
export function previewAcademicRemoval(
  db: V2Database,
  actor: Actor,
  entity: ManagedEntity,
  id: number,
  legacy?: DatabaseConnection,
) {
  const scope = entityScope(db, entity, id);
  if (
    !isAdmin(db, actor) &&
    !canManage(
      db,
      actor,
      entity === "cohorts" ? "manage_cohort" : "manage_academics",
      scope,
    )
  )
    throw new Error("Sem permissão neste contexto.");
  const dependencies: Array<{ table: string; label: string; count: number }> =
    [];
  for (const { name } of db
    .prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'",
    )
    .all() as Array<{ name: string }>) {
    const safe = name.replaceAll('"', '""');
    for (const fk of db.pragma(`foreign_key_list("${safe}")`) as Array<{
      table: string;
      from: string;
    }>) {
      if (fk.table !== entity) continue;
      const n = (
        db
          .prepare(
            `SELECT count(*) n FROM "${safe}" WHERE "${fk.from.replaceAll('"', '""')}"=?`,
          )
          .get(id) as { n: number }
      ).n;
      if (n)
        dependencies.push({
          table: name,
          label: dependencyLabels[name] ?? "Outros vínculos preservados",
          count: n,
        });
    }
  }
  const map = db
    .prepare(
      "SELECT legacy_id id FROM academic_legacy_ids WHERE entity=? AND canonical_id=?",
    )
    .get(entity, id) as { id: number } | undefined;
  if (
    !dependencies.length &&
    map &&
    (legacy || process.env.OPENSTUDYHUB_V2_ENABLED === "1")
  ) {
    const sql = (legacy ?? getDatabase()).sqlite;
    const links: Partial<Record<ManagedEntity, string>> = {
      programs: "program_id",
      subjects: "subject_id",
      academic_periods: "academic_period_id",
      instructors: "instructor_id",
      locations: "location_id",
    };
    if (links[entity]) {
      const table =
        entity === "locations" ? "schedule_slots" : "subject_offerings";
      const count = (
        sql
          .prepare(`SELECT count(*) n FROM ${table} WHERE ${links[entity]}=?`)
          .get(map.id) as { n: number }
      ).n;
      if (count)
        dependencies.push({
          table: "legacy_content",
          label: "Histórico acadêmico preservado nas ferramentas",
          count,
        });
    }
  }
  return {
    dependencies,
    canDelete: isAdmin(db, actor) && dependencies.length === 0,
  };
}
