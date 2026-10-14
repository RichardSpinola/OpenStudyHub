import type { V2Database } from "./database";
import type { Actor } from "./actor";
import { isAdmin } from "./access";
import { DEFAULT_ACADEMIC_TIME_ZONE } from "../academic-clock";
export function academicTimeZoneForUser(db: V2Database, userId: number) {
  const row = db
    .prepare(
      `SELECT t.time_zone zone FROM enrollments e JOIN offerings o ON o.id=e.offering_id JOIN programs p ON p.id=o.program_id JOIN institution_timezones t ON t.institution_id=p.institution_id WHERE e.user_id=? AND e.withdrawn_at IS NULL AND o.archived_at IS NULL ORDER BY o.id LIMIT 1`,
    )
    .get(userId) as { zone: string } | undefined;
  return row?.zone ?? DEFAULT_ACADEMIC_TIME_ZONE;
}
export function setInstitutionTimeZone(
  db: V2Database,
  actor: Actor,
  id: number,
  zone: string,
) {
  if (!isAdmin(db, actor))
    throw new Error("Somente Admin pode configurar o fuso.");
  try {
    new Intl.DateTimeFormat("en", { timeZone: zone }).format();
  } catch {
    throw new Error("Fuso inválido. Use uma região como America/Bahia.");
  }
  if (
    !db
      .prepare("SELECT 1 FROM institutions WHERE id=? AND archived_at IS NULL")
      .get(id)
  )
    throw new Error("Instituição não disponível.");
  db.prepare(
    "INSERT INTO institution_timezones(institution_id,time_zone) VALUES(?,?) ON CONFLICT(institution_id) DO UPDATE SET time_zone=excluded.time_zone",
  ).run(id, zone);
}

export function academicTimeZoneForLegacyUser(
  db: V2Database,
  legacyId: number,
) {
  const user = db
    .prepare("SELECT user_id id FROM legacy_user_links WHERE legacy_user_id=?")
    .get(legacyId) as { id: number } | undefined;
  return user
    ? academicTimeZoneForUser(db, user.id)
    : DEFAULT_ACADEMIC_TIME_ZONE;
}
