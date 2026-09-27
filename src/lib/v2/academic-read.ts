import type {
  AgendaSlot,
  CurrentAcademicPeriod,
  SubjectOfferingSummary,
  SubjectRecord,
} from "@/lib/academic";
import type { V2Database } from "./database";

function userId(value: number): number {
  if (!Number.isSafeInteger(value) || value < 1)
    throw new Error("Invalid user.");
  return value;
}

const enrolledOffering = `
  FROM enrollments e
  JOIN users u ON u.id=e.user_id AND u.active=1
  JOIN offerings o ON o.id=e.offering_id AND o.archived_at IS NULL AND o.state!='cancelled'
  JOIN subjects s ON s.id=o.subject_id AND s.archived_at IS NULL
  JOIN programs p ON p.id=o.program_id AND p.archived_at IS NULL AND p.institution_id=s.institution_id
  JOIN academic_periods ap ON ap.id=o.period_id AND ap.archived_at IS NULL AND ap.institution_id=p.institution_id
  LEFT JOIN instructors i ON i.id=o.instructor_id AND i.archived_at IS NULL
  LEFT JOIN curriculum_subjects cs ON cs.id=o.curriculum_subject_id
  LEFT JOIN curriculum_semesters semester ON semester.id=cs.semester_id
`;
const enrolledWhere = "WHERE e.user_id=? AND e.withdrawn_at IS NULL";

const offeringColumns = `
  o.id offeringId,s.id subjectId,s.code subjectCode,s.name subjectName,
  NULL subjectShortName,p.name programName,p.short_name programShortName,
  ap.label periodLabel,i.name instructorName,o.class_group classGroup,
  (SELECT c.name FROM offering_cohorts oc
   JOIN cohorts c ON c.id=oc.cohort_id AND c.archived_at IS NULL
   JOIN user_academic_contexts x ON x.cohort_id=c.id
     AND x.user_id=e.user_id AND x.current=1 AND x.program_id=o.program_id
   JOIN cohort_periods cp ON cp.id=x.cohort_period_id
     AND cp.cohort_id=c.id AND cp.period_id=o.period_id
   WHERE oc.offering_id=o.id
   ORDER BY c.id LIMIT 1) cohortName,
  CAST(semester.ordinal AS TEXT) curriculumTerm,o.state status
`;

export function listV2UserOfferings(
  db: V2Database,
  canonicalUserId: number,
): SubjectOfferingSummary[] {
  return db
    .prepare(
      `SELECT ${offeringColumns} ${enrolledOffering}
       ${enrolledWhere}
       ORDER BY s.name COLLATE NOCASE,ap.starts_on DESC,o.id`,
    )
    .all(userId(canonicalUserId)) as SubjectOfferingSummary[];
}

export function listV2UserSubjects(
  db: V2Database,
  canonicalUserId: number,
): SubjectRecord[] {
  const subjects = new Map<number, SubjectRecord>();
  for (const offering of listV2UserOfferings(db, canonicalUserId))
    subjects.set(offering.subjectId, {
      id: offering.subjectId,
      code: offering.subjectCode,
      name: offering.subjectName,
      shortName: offering.subjectShortName,
    });
  return [...subjects.values()].sort((a, b) =>
    a.name.localeCompare(b.name, undefined, { sensitivity: "base" }),
  );
}

export function getV2UserSubject(
  db: V2Database,
  canonicalUserId: number,
  subjectId: number,
): SubjectRecord | null {
  if (!Number.isSafeInteger(subjectId) || subjectId < 1) return null;
  return (
    listV2UserSubjects(db, canonicalUserId).find(
      (subject) => subject.id === subjectId,
    ) ?? null
  );
}

export function listV2UserAgenda(
  db: V2Database,
  canonicalUserId: number,
): AgendaSlot[] {
  return db
    .prepare(
      `SELECT ${offeringColumns},
        slot.id slotId,slot.weekday,slot.starts_at_minutes startsAtMinutes,
        slot.ends_at_minutes endsAtMinutes,ap.starts_on validFrom,
        ap.ends_on validUntil,l.name locationName,l.campus,
        NULL building,l.room
       ${enrolledOffering}
       JOIN schedule_slots slot ON slot.offering_id=o.id
       LEFT JOIN locations l ON l.id=slot.location_id
         AND l.institution_id=p.institution_id AND l.archived_at IS NULL
       ${enrolledWhere}
       ORDER BY slot.weekday,slot.starts_at_minutes,s.name COLLATE NOCASE`,
    )
    .all(userId(canonicalUserId)) as AgendaSlot[];
}

export function getV2UserCurrentPeriod(
  db: V2Database,
  canonicalUserId: number,
  date = new Date(),
): CurrentAcademicPeriod | null {
  const iso = [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
  const row = db
    .prepare(
      `SELECT DISTINCT ap.id,ap.label,ap.starts_on startsOn,ap.ends_on endsOn
       ${enrolledOffering}
       ${enrolledWhere}
       ORDER BY CASE WHEN ap.starts_on<=? AND ap.ends_on>=? THEN 0 ELSE 1 END,
                ap.starts_on DESC,ap.id DESC LIMIT 1`,
    )
    .get(userId(canonicalUserId), iso, iso) as
    CurrentAcademicPeriod | undefined;
  return row ?? null;
}

export function v2UserOfferingIdsWithCover(
  db: V2Database,
  canonicalUserId: number,
): Set<number> {
  const rows = db
    .prepare(
      `SELECT c.offering_id id FROM offering_covers c
       JOIN enrollments e ON e.offering_id=c.offering_id
       JOIN users u ON u.id=e.user_id AND u.active=1
       JOIN offerings o ON o.id=e.offering_id AND o.archived_at IS NULL AND o.state!='cancelled'
       WHERE e.user_id=? AND e.withdrawn_at IS NULL`,
    )
    .all(userId(canonicalUserId)) as Array<{ id: number }>;
  return new Set(rows.map((row) => row.id));
}

// A link is optional compatibility for old V1-backed notes/documents/projects.
// Academic visibility never depends on this table.
export function legacyOfferingIdsForV2User(
  db: V2Database,
  canonicalUserId: number,
): Map<number, number> {
  const rows = db
    .prepare(
      `SELECT l.offering_id offeringId,l.legacy_offering_id legacyOfferingId
       FROM legacy_offering_links l
       JOIN enrollments e ON e.offering_id=l.offering_id
       JOIN offerings o ON o.id=e.offering_id
       WHERE e.user_id=? AND e.withdrawn_at IS NULL
         AND o.archived_at IS NULL AND o.state!='cancelled'`,
    )
    .all(userId(canonicalUserId)) as Array<{
    offeringId: number;
    legacyOfferingId: number;
  }>;
  return new Map(rows.map((row) => [row.offeringId, row.legacyOfferingId]));
}
