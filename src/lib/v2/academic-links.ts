import type { V2Database } from "./database";
import { withV2Db } from "./runtime-database";
export function canonicalSubjectForLegacyOffering(
  db: V2Database,
  legacyUserId: number,
  legacyOfferingId: number,
) {
  const row = db
    .prepare(
      `SELECT o.subject_id id FROM legacy_offering_links l JOIN offerings o ON o.id=l.offering_id JOIN enrollments e ON e.offering_id=o.id AND e.withdrawn_at IS NULL JOIN legacy_user_links u ON u.user_id=e.user_id WHERE l.legacy_offering_id=? AND u.legacy_user_id=? AND o.archived_at IS NULL AND o.state!='cancelled'`,
    )
    .get(legacyOfferingId, legacyUserId) as { id: number } | undefined;
  return row?.id ?? null;
}
export function subjectResourceHref(
  legacyUserId: number,
  offeringId: number | null,
  legacySubjectId: number | null,
  view: "notes" | "projects",
) {
  const fallback = view === "projects" ? "/library?type=projects" : "/notes";
  if (offeringId === null) return fallback;
  const subject =
    process.env.OPENSTUDYHUB_V2_ENABLED === "1"
      ? withV2Db((db) =>
          canonicalSubjectForLegacyOffering(db, legacyUserId, offeringId),
        )
      : legacySubjectId;
  return subject ? `/subjects/${subject}?view=${view}` : fallback;
}
