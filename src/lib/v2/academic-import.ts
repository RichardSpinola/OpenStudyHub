import type { V2Database } from "./database";
import type { Actor } from "./actor";
import { isAdmin } from "./access";
import { v1Fingerprint } from "./importer";
/** Upgrade the paired legacy DB in place; private content and asset paths stay intact.
 * Explicit review does not promote legacy Admin privileges or global Google mappings. */
function applyAcademicImportSnapshot(
  source: V2Database,
  target: V2Database,
  actor: Actor,
  input: { runId: number; institutionId: number; reviewed: boolean },
) {
  if (!isAdmin(target, actor)) throw new Error("Somente Admin pode importar.");
  if (!input.reviewed)
    throw new Error("Revise as pendências antes de importar.");
  const run = target
    .prepare("SELECT * FROM import_runs WHERE id=?")
    .get(input.runId) as
    { source_fingerprint: string; status: string } | undefined;
  if (!run || run.source_fingerprint !== v1Fingerprint(source))
    throw new Error("A origem mudou. Gere uma nova prévia.");
  if (
    !target
      .prepare("SELECT 1 FROM institutions WHERE id=? AND archived_at IS NULL")
      .get(input.institutionId)
  )
    throw new Error("Escolha uma instituição ativa.");
  if (run.status === "completed") return { repeated: true };
  if ((source.pragma("foreign_key_check") as unknown[]).length)
    throw new Error("A origem contém vínculos inválidos.");
  target.transaction(() => {
    type Row = Record<string, string | number | null>;
    const bind = (table: string, sourceId: number, targetId: number) =>
      target
        .prepare(
          "INSERT INTO import_id_map(run_id,source_table,source_id,target_table,target_id) VALUES(?,?,?,?,?)",
        )
        .run(
          input.runId,
          table,
          sourceId,
          table === "subject_offerings" ? "offerings" : table,
          targetId,
        );
    const map = (table: string, id: number) => {
      const row = target
        .prepare(
          "SELECT canonical_id id FROM academic_legacy_ids WHERE entity=? AND legacy_id=?",
        )
        .get(table, id) as { id: number } | undefined;
      if (!row) throw new Error("Referência acadêmica não resolvida.");
      return row.id;
    };
    for (const table of [
      "programs",
      "subjects",
      "academic_periods",
      "instructors",
      "locations",
    ])
      for (const row of source
        .prepare(`SELECT * FROM ${table}`)
        .all() as Row[]) {
        let id = (
          target
            .prepare(
              "SELECT canonical_id id FROM academic_legacy_ids WHERE entity=? AND legacy_id=?",
            )
            .get(table, row.id) as { id: number } | undefined
        )?.id;
        if (!id) {
          const fields: Row = {
            institution_id: input.institutionId,
            archived_at: row.active === 0 ? Date.now() : null,
          };
          if (table === "academic_periods") {
            fields.label = row.label;
            fields.starts_on = row.starts_on;
            fields.ends_on = row.ends_on;
          } else {
            fields.name = row.name;
            if (table === "programs") {
              fields.code = row.code || `import-${row.id}`;
              fields.short_name = row.short_name;
            }
            if (table === "subjects") fields.code = row.code;
            if (table === "locations") {
              fields.campus = row.campus;
              fields.room = row.room;
            }
          }
          const keys = Object.keys(fields);
          id = Number(
            target
              .prepare(
                `INSERT INTO ${table}(${keys.join(",")}) VALUES(${keys.map(() => "?").join(",")})`,
              )
              .run(...Object.values(fields)).lastInsertRowid,
          );
          target
            .prepare(
              "INSERT INTO academic_legacy_ids(entity,canonical_id,legacy_id) VALUES(?,?,?)",
            )
            .run(table, id, row.id);
        }
        const scope = target
          .prepare(`SELECT institution_id id FROM ${table} WHERE id=?`)
          .get(id) as { id: number };
        if (scope.id !== input.institutionId)
          throw new Error(
            "Estes registros já pertencem a outra instituição. Confira o destino.",
          );
        bind(table, Number(row.id), id);
      }
    for (const row of source
      .prepare("SELECT * FROM subject_offerings")
      .all() as Row[]) {
      let id = (
        target
          .prepare(
            "SELECT offering_id id FROM legacy_offering_links WHERE legacy_offering_id=?",
          )
          .get(row.id) as { id: number } | undefined
      )?.id;
      if (!id) {
        id = Number(
          target
            .prepare(
              "INSERT INTO offerings(subject_id,program_id,period_id,instructor_id,class_group,state) VALUES(?,?,?,?,?,?)",
            )
            .run(
              map("subjects", Number(row.subject_id)),
              map("programs", Number(row.program_id)),
              map("academic_periods", Number(row.academic_period_id)),
              row.instructor_id === null
                ? null
                : map("instructors", Number(row.instructor_id)),
              row.class_group,
              row.status,
            ).lastInsertRowid,
        );
        target
          .prepare(
            "INSERT INTO legacy_offering_links(offering_id,legacy_offering_id,linked_by_admin_id,linked_at,link_source) VALUES(?,?,?,?, 'import')",
          )
          .run(id, row.id, actor.id, Date.now());
        for (const slot of source
          .prepare("SELECT * FROM schedule_slots WHERE offering_id=?")
          .all(row.id) as Row[])
          target
            .prepare(
              "INSERT INTO schedule_slots(offering_id,weekday,starts_at_minutes,ends_at_minutes,location_id) VALUES(?,?,?,?,?)",
            )
            .run(
              id,
              slot.weekday,
              slot.starts_at_minutes,
              slot.ends_at_minutes,
              slot.location_id === null
                ? null
                : map("locations", Number(slot.location_id)),
            );
      }
      bind("subject_offerings", Number(row.id), id);
    }
    for (const user of source
      .prepare("SELECT * FROM users WHERE role='member'")
      .all() as Row[]) {
      let id = (
        target
          .prepare(
            "SELECT user_id id FROM legacy_user_links WHERE legacy_user_id=?",
          )
          .get(user.id) as { id: number } | undefined
      )?.id;
      if (!id) {
        if (
          target
            .prepare("SELECT 1 FROM users WHERE login=? COLLATE NOCASE")
            .get(user.login)
        )
          throw new Error(
            "Login já existe sem vínculo confirmado. Resolva o conflito antes de importar.",
          );
        id = Number(
          target
            .prepare(
              "INSERT INTO users(login,display_name,password_hash,active) VALUES(?,?,?,?)",
            )
            .run(user.login, user.display_name, user.password_hash, user.active)
            .lastInsertRowid,
        );
        target
          .prepare(
            "INSERT INTO legacy_user_links(user_id,legacy_user_id) VALUES(?,?)",
          )
          .run(id, user.id);
      }
      bind("users", Number(user.id), id);
      for (const enrollment of source
        .prepare("SELECT offering_id FROM enrollments WHERE user_id=?")
        .all(user.id) as Array<{ offering_id: number }>) {
        const offering = target
          .prepare(
            "SELECT offering_id id FROM legacy_offering_links WHERE legacy_offering_id=?",
          )
          .get(enrollment.offering_id) as { id: number };
        target
          .prepare(
            "INSERT INTO enrollments(user_id,offering_id,source) VALUES(?,?,'exception') ON CONFLICT(user_id,offering_id) DO NOTHING",
          )
          .run(id, offering.id);
      }
    }
    target
      .prepare("UPDATE import_review_items SET resolved_at=? WHERE run_id=?")
      .run(Date.now(), input.runId);
    target
      .prepare("UPDATE import_runs SET status='completed' WHERE id=?")
      .run(input.runId);
  })();
  return { repeated: false };
}

export function applyAcademicImport(
  source: V2Database,
  target: V2Database,
  actor: Actor,
  input: { runId: number; institutionId: number; reviewed: boolean },
) {
  return source.transaction(() =>
    applyAcademicImportSnapshot(source, target, actor, input),
  )();
}
