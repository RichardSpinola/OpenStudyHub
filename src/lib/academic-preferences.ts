import type { V2Database } from "@/lib/v2/database";
import { withV2Db } from "@/lib/v2/runtime";

export type AcademicPreferences = {
  overviewFocus: "wall" | "timeline";
  showSubjectHistory: boolean;
};

export const defaultAcademicPreferences: AcademicPreferences = {
  overviewFocus: "wall",
  showSubjectHistory: false,
};

export function getAcademicPreferencesFromDb(
  db: V2Database,
  canonicalUserId: number,
): AcademicPreferences {
  const row = db
    .prepare(
      "SELECT overview_focus focus,show_subject_history history FROM user_academic_preferences WHERE user_id=?",
    )
    .get(canonicalUserId) as
    { focus: "wall" | "timeline"; history: number } | undefined;
  return row
    ? { overviewFocus: row.focus, showSubjectHistory: row.history === 1 }
    : defaultAcademicPreferences;
}

export function saveAcademicPreferencesToDb(
  db: V2Database,
  canonicalUserId: number,
  value: AcademicPreferences,
): void {
  db.prepare(
    `INSERT INTO user_academic_preferences(user_id,overview_focus,show_subject_history,updated_at)
     VALUES(?,?,?,?) ON CONFLICT(user_id) DO UPDATE SET
     overview_focus=excluded.overview_focus,
     show_subject_history=excluded.show_subject_history,
     updated_at=excluded.updated_at`,
  ).run(
    canonicalUserId,
    value.overviewFocus,
    value.showSubjectHistory ? 1 : 0,
    Date.now(),
  );
}

function canonicalId(db: V2Database, legacyUserId: number): number | null {
  const row = db
    .prepare("SELECT user_id id FROM legacy_user_links WHERE legacy_user_id=?")
    .get(legacyUserId) as { id: number } | undefined;
  return row?.id ?? null;
}

export function getAcademicPreferences(
  legacyUserId: number,
): AcademicPreferences {
  if (process.env.OPENSTUDYHUB_V2_ENABLED !== "1")
    return defaultAcademicPreferences;
  return withV2Db((db) => {
    const id = canonicalId(db, legacyUserId);
    return id === null
      ? defaultAcademicPreferences
      : getAcademicPreferencesFromDb(db, id);
  });
}

export function updateAcademicPreferences(
  legacyUserId: number,
  patch: Partial<AcademicPreferences>,
): void {
  if (process.env.OPENSTUDYHUB_V2_ENABLED !== "1") return;
  withV2Db((db) => {
    const id = canonicalId(db, legacyUserId);
    if (id === null) throw new Error("Identidade V2 não vinculada.");
    saveAcademicPreferencesToDb(db, id, {
      ...getAcademicPreferencesFromDb(db, id),
      ...patch,
    });
  });
}
