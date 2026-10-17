import { getDatabase, type DatabaseConnection } from "@/lib/db/client";
import type { V2Database } from "./database";
export class AcademicProjectionError extends Error {
  constructor(cause: unknown) {
    super(
      "Não foi possível atualizar o contexto acadêmico. Os dados foram preservados; peça ao Admin para conferir a sincronização.",
      { cause },
    );
    this.name = "AcademicProjectionError";
  }
}
type Row = Record<string, number | string | null>;
const entities = [
  "programs",
  "subjects",
  "academic_periods",
  "instructors",
  "locations",
] as const;
export function synchronizeAcademicProjection(
  db: V2Database,
  legacy: DatabaseConnection = getDatabase(),
  force = false,
) {
  const state = db
    .prepare(
      "SELECT revision,applied_revision applied,instance_id namespace FROM academic_projection_state WHERE id=1",
    )
    .get() as
    { revision: number; applied: number; namespace: string } | undefined;
  if (!state || (!force && state.revision === state.applied)) return false;
  try {
    // Transactions protect each database independently. A crash between commits is
    // repaired by retrying the deterministic projection; no cross-WAL atomicity is claimed.
    db.transaction(() =>
      legacy.sqlite.transaction(() => {
        const key = (entity: string, id: number) =>
          `v3.projection.${state.namespace}.${entity}.${id}`;
        function durable(entity: string, id: number) {
          const row = legacy.sqlite
            .prepare("SELECT value FROM app_settings WHERE key=?")
            .get(key(entity, id)) as { value: string } | undefined;
          return row ? Number(row.value) : undefined;
        }
        function remember(entity: string, id: number, target: number) {
          legacy.sqlite
            .prepare(
              "INSERT INTO app_settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value",
            )
            .run(key(entity, id), String(target));
        }
        function mapping(entity: string, id: number) {
          return (
            db
              .prepare(
                "SELECT legacy_id id FROM academic_legacy_ids WHERE entity=? AND canonical_id=?",
              )
              .get(entity, id) as { id: number } | undefined
          )?.id;
        }
        function bind(entity: string, id: number, legacyId: number) {
          const existing = mapping(entity, id);
          if (existing !== undefined && existing !== legacyId)
            throw new Error("Conflicting academic identity link");
          db.prepare(
            "INSERT INTO academic_legacy_ids(entity,canonical_id,legacy_id) VALUES(?,?,?) ON CONFLICT(entity,canonical_id) DO NOTHING",
          ).run(entity, id, legacyId);
        }
        // Adopt only explicit, previously confirmed links. Never guess by name or ID.
        const prior = db
          .prepare(
            "SELECT l.offering_id id,l.legacy_offering_id legacyId,o.subject_id,o.program_id,o.period_id,o.instructor_id FROM legacy_offering_links l JOIN offerings o ON o.id=l.offering_id ORDER BY o.subject_id,o.id",
          )
          .all() as Array<Row>;
        for (const row of prior) {
          const old = legacy.sqlite
            .prepare("SELECT * FROM subject_offerings WHERE id=?")
            .get(row.legacyId) as Row | undefined;
          if (!old) throw new Error("Linked legacy offering is missing");
          for (const [entity, key, oldKey] of [
            ["subjects", "subject_id", "subject_id"],
            ["programs", "program_id", "program_id"],
            ["academic_periods", "period_id", "academic_period_id"],
            ["instructors", "instructor_id", "instructor_id"],
          ]) {
            if (row[key] !== null && old[oldKey] !== null) {
              const canonicalId = Number(row[key]);
              const legacyId = Number(old[oldKey]);
              const owner = db
                .prepare(
                  "SELECT canonical_id id FROM academic_legacy_ids WHERE entity=? AND legacy_id=?",
                )
                .get(entity, legacyId) as { id: number } | undefined;
              // Older confirmed offering links can share one V1 subject across
              // distinct canonical subjects. Give the other subject its own
              // metadata row below; keep every offering ID and its contents.
              if (!owner || owner.id === canonicalId)
                bind(entity, canonicalId, legacyId);
            }
          }
        }
        for (const entity of entities) {
          for (const row of db
            .prepare(`SELECT * FROM ${entity} ORDER BY id`)
            .all() as Row[]) {
            const id = Number(row.id);
            let target = mapping(entity, id) ?? durable(entity, id);
            if (target !== undefined) bind(entity, id, target);
            let values: Row;
            if (entity === "academic_periods") {
              const institution = db
                .prepare("SELECT name FROM institutions WHERE id=?")
                .get(row.institution_id) as { name: string };
              values = {
                label: `${row.label} · ${institution.name}`,
                starts_on: row.starts_on,
                ends_on: row.ends_on,
                active: row.archived_at === null ? 1 : 0,
              };
            } else {
              values = {
                name: row.name,
                active: row.archived_at === null ? 1 : 0,
              };
              if (entity === "programs") values.short_name = row.short_name;
              if (entity === "programs" || entity === "subjects") {
                // V1 codes are globally unique, V2 codes belong to an institution.
                const collision =
                  row.code &&
                  legacy.sqlite
                    .prepare(`SELECT id FROM ${entity} WHERE code=? AND id!=?`)
                    .get(row.code, target ?? -1);
                values.code = collision ? null : row.code;
              }
              if (entity === "locations") {
                values.campus = row.campus;
                values.room = row.room;
              }
            }
            const keys = Object.keys(values);
            if (target !== undefined) {
              const result = legacy.sqlite
                .prepare(
                  `UPDATE ${entity} SET ${keys.map((k) => `${k}=?`).join(",")},updated_at=? WHERE id=?`,
                )
                .run(...Object.values(values), Date.now(), target);
              if (result.changes !== 1)
                throw new Error("Missing mapped academic entity");
            } else {
              target = Number(
                legacy.sqlite
                  .prepare(
                    `INSERT INTO ${entity}(${keys.join(",")}) VALUES(${keys.map(() => "?").join(",")})`,
                  )
                  .run(...Object.values(values)).lastInsertRowid,
              );
              bind(entity, id, target);
              remember(entity, id, target);
            }
          }
        }
        for (const row of db
          .prepare(
            "SELECT o.*,cs.ordinal semester FROM offerings o LEFT JOIN curriculum_subjects m ON m.id=o.curriculum_subject_id LEFT JOIN curriculum_semesters cs ON cs.id=m.semester_id ORDER BY o.id",
          )
          .all() as Row[]) {
          let target = (
            db
              .prepare(
                "SELECT legacy_offering_id id FROM legacy_offering_links WHERE offering_id=?",
              )
              .get(row.id) as { id: number } | undefined
          )?.id;
          target ??= durable("offerings", Number(row.id));
          if (
            target !== undefined &&
            !db
              .prepare(
                "SELECT 1 FROM legacy_offering_links WHERE offering_id=?",
              )
              .get(row.id)
          )
            db.prepare(
              "INSERT INTO legacy_offering_links(offering_id,legacy_offering_id,linked_at,link_source) VALUES(?,?,?,'automatic')",
            ).run(row.id, target, Date.now());
          const values = [
            mapping("subjects", Number(row.subject_id)),
            mapping("programs", Number(row.program_id)),
            mapping("academic_periods", Number(row.period_id)),
            row.instructor_id === null
              ? null
              : mapping("instructors", Number(row.instructor_id)),
            row.class_group,
            row.semester === null
              ? target === undefined
                ? null
                : ((
                    legacy.sqlite
                      .prepare(
                        "SELECT curriculum_term term FROM subject_offerings WHERE id=?",
                      )
                      .get(target) as { term: string | null } | undefined
                  )?.term ?? null)
              : String(row.semester),
            row.archived_at === null ? row.state : "cancelled",
          ];
          if (target !== undefined)
            legacy.sqlite
              .prepare(
                "UPDATE subject_offerings SET subject_id=?,program_id=?,academic_period_id=?,instructor_id=?,class_group=?,curriculum_term=?,status=?,updated_at=? WHERE id=?",
              )
              .run(...values, Date.now(), target);
          else {
            target = Number(
              legacy.sqlite
                .prepare(
                  "INSERT INTO subject_offerings(subject_id,program_id,academic_period_id,instructor_id,class_group,curriculum_term,status) VALUES(?,?,?,?,?,?,?)",
                )
                .run(...values).lastInsertRowid,
            );
            remember("offerings", Number(row.id), target);
            db.prepare(
              "INSERT INTO legacy_offering_links(offering_id,legacy_offering_id,linked_at,link_source) VALUES(?,?,?,'automatic')",
            ).run(row.id, target, Date.now());
          }
          // Schedules are derived metadata; notes, activities and project history stay untouched.
          legacy.sqlite
            .prepare("DELETE FROM schedule_slots WHERE offering_id=?")
            .run(target);
          if (row.archived_at === null && row.state !== "cancelled")
            for (const slot of db
              .prepare("SELECT * FROM schedule_slots WHERE offering_id=?")
              .all(row.id) as Row[]) {
              legacy.sqlite
                .prepare(
                  "INSERT INTO schedule_slots(offering_id,weekday,starts_at_minutes,ends_at_minutes,location_id) VALUES(?,?,?,?,?)",
                )
                .run(
                  target,
                  slot.weekday,
                  slot.starts_at_minutes,
                  slot.ends_at_minutes,
                  slot.location_id === null
                    ? null
                    : mapping("locations", Number(slot.location_id)),
                );
            }
        }
        for (const link of db
          .prepare(
            "SELECT l.user_id canonicalId,l.legacy_user_id legacyId,u.active,u.display_name,u.password_hash FROM legacy_user_links l JOIN users u ON u.id=l.user_id",
          )
          .all() as Row[]) {
          const user = legacy.sqlite
            .prepare("SELECT role FROM users WHERE id=?")
            .get(link.legacyId) as { role: string } | undefined;
          if (!user || user.role !== "member")
            throw new Error("Invalid normal-user identity link");
          legacy.sqlite
            .prepare(
              "UPDATE users SET active=?,display_name=?,password_hash=? WHERE id=?",
            )
            .run(
              link.active,
              link.display_name,
              link.password_hash,
              link.legacyId,
            );
          legacy.sqlite
            .prepare(
              "DELETE FROM enrollments WHERE user_id=? AND offering_id IN (SELECT id FROM subject_offerings WHERE id IN (SELECT value FROM json_each(?)))",
            )
            .run(
              link.legacyId,
              JSON.stringify(
                db
                  .prepare(
                    "SELECT legacy_offering_id value FROM legacy_offering_links",
                  )
                  .all()
                  .map((r) => (r as { value: number }).value),
              ),
            );
          if (link.active === 1)
            for (const row of db
              .prepare(
                `SELECT l.legacy_offering_id id FROM enrollments e JOIN legacy_offering_links l ON l.offering_id=e.offering_id JOIN offerings o ON o.id=e.offering_id JOIN programs p ON p.id=o.program_id JOIN subjects s ON s.id=o.subject_id JOIN academic_periods ap ON ap.id=o.period_id JOIN institutions i ON i.id=p.institution_id WHERE e.user_id=? AND e.withdrawn_at IS NULL AND o.archived_at IS NULL AND o.state!='cancelled' AND p.archived_at IS NULL AND s.archived_at IS NULL AND ap.archived_at IS NULL AND i.archived_at IS NULL`,
              )
              .all(link.canonicalId) as Array<{ id: number }>) {
              legacy.sqlite
                .prepare(
                  "INSERT INTO enrollments(user_id,offering_id) VALUES(?,?)",
                )
                .run(link.legacyId, row.id);
            }
        }
        projectClassroom(db, legacy);
      })(),
    )();
    // Mark only after both commits. Repeated projection keeps original linked IDs.
    db.prepare(
      "UPDATE academic_projection_state SET applied_revision=revision WHERE id=1",
    ).run();
    return true;
  } catch (error) {
    throw new AcademicProjectionError(error);
  }
}
function projectClassroom(db: V2Database, legacy: DatabaseConnection) {
  // Archive stale derived records, including withdrawn or remapped classrooms.
  for (const row of db
    .prepare(
      "SELECT legacy_activity_id id FROM legacy_classroom_activity_links",
    )
    .all() as Array<{ id: number }>)
    legacy.sqlite
      .prepare(
        "UPDATE activities SET status='archived' WHERE id=? AND origin='external'",
      )
      .run(row.id);
  const rows = db
    .prepare(
      `SELECT f.*,m.course_id courseId,u.legacy_user_id legacyUser,o.legacy_offering_id legacyOffering FROM classroom_feed_v2 f JOIN legacy_user_links u ON u.user_id=f.user_id JOIN legacy_offering_links o ON o.offering_id=f.offering_id JOIN user_classroom_mappings m ON m.user_id=f.user_id AND m.offering_id=f.offering_id JOIN enrollments e ON e.user_id=f.user_id AND e.offering_id=f.offering_id AND e.withdrawn_at IS NULL WHERE f.external_id LIKE '0:%'`,
    )
    .all() as Row[];
  for (const row of rows) {
    if (
      !legacy.sqlite
        .prepare("SELECT 1 FROM enrollments WHERE user_id=? AND offering_id=?")
        .get(row.legacyUser, row.legacyOffering)
    )
      continue;
    const linkKey = `${row.courseId}:${row.external_id}`;
    let old = db
      .prepare(
        "SELECT legacy_activity_id id FROM legacy_classroom_activity_links WHERE user_id=? AND offering_id=? AND external_id=?",
      )
      .get(row.user_id, row.offering_id, linkKey) as { id: number } | undefined;
    if (!old) {
      const existing = legacy.sqlite
        .prepare(
          "SELECT id FROM activities WHERE user_id=? AND offering_id=? AND origin='external' AND external_source='classroom' AND external_id=?",
        )
        .get(
          row.legacyUser,
          row.legacyOffering,
          `v3:${row.user_id}:${row.offering_id}:${linkKey}`,
        ) as { id: number } | undefined;
      if (existing) {
        old = existing;
        db.prepare(
          "INSERT INTO legacy_classroom_activity_links(user_id,offering_id,external_id,legacy_activity_id) VALUES(?,?,?,?)",
        ).run(row.user_id, row.offering_id, linkKey, old.id);
      }
    }
    if (!old) {
      const candidate = legacy.sqlite
        .prepare(
          "SELECT id FROM activities WHERE user_id=? AND offering_id=? AND origin='external' AND external_source='classroom' AND external_id=?",
        )
        .get(
          row.legacyUser,
          row.legacyOffering,
          `${row.courseId}:${String(row.external_id).slice(2)}`,
        ) as { id: number } | undefined;
      if (candidate) {
        old = candidate;
        db.prepare(
          "DELETE FROM legacy_classroom_activity_links WHERE user_id=? AND offering_id=? AND legacy_activity_id=? AND external_id LIKE '_unverified:%'",
        ).run(row.user_id, row.offering_id, old.id);
        db.prepare(
          "INSERT INTO legacy_classroom_activity_links(user_id,offering_id,external_id,legacy_activity_id) VALUES(?,?,?,?)",
        ).run(row.user_id, row.offering_id, linkKey, old.id);
      }
    }
    const status =
      row.submission_state === "TURNED_IN"
        ? "submitted"
        : row.submission_state === "RETURNED" && row.submission_graded === 1
          ? "completed"
          : "pending";
    const values = [
      String(row.title).slice(0, 160),
      row.description,
      row.due_at,
      status,
      row.link,
    ];
    if (old)
      legacy.sqlite
        .prepare(
          "UPDATE activities SET title=?,description=?,due_at=?,status=?,external_url=?,updated_at=? WHERE id=? AND user_id=? AND origin='external'",
        )
        .run(...values, Date.now(), old.id, row.legacyUser);
    else {
      const id = Number(
        legacy.sqlite
          .prepare(
            "INSERT INTO activities(user_id,offering_id,title,description,due_at,status,external_url,origin,external_source,external_id) VALUES(?,?,?,?,?,?,?,'external','classroom',?)",
          )
          .run(
            row.legacyUser,
            row.legacyOffering,
            ...values,
            `v3:${row.user_id}:${row.offering_id}:${linkKey}`,
          ).lastInsertRowid,
      );
      db.prepare(
        "INSERT INTO legacy_classroom_activity_links(user_id,offering_id,external_id,legacy_activity_id) VALUES(?,?,?,?)",
      ).run(row.user_id, row.offering_id, linkKey, id);
    }
  }
}
