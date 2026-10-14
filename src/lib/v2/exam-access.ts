import { withV2Db } from "./runtime-database";
import { activeExam } from "./academic-events";
export function examForLegacyUser(legacyUserId: number) {
  if (process.env.OPENSTUDYHUB_V2_ENABLED !== "1") return null;
  return withV2Db((db) => {
    const u = db
      .prepare(
        "SELECT user_id id FROM legacy_user_links WHERE legacy_user_id=?",
      )
      .get(legacyUserId) as { id: number } | undefined;
    return u ? activeExam(db, u.id) : null;
  });
}
export function assertToolAvailable(legacyUserId: number) {
  if (examForLegacyUser(legacyUserId))
    throw new Error(
      "Recurso temporariamente indisponível durante o modo de prova.",
    );
}
