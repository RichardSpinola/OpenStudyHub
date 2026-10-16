import { getDatabase, type DatabaseConnection } from "./db/client";
import { listUserSubjectOfferings, listUserAgenda } from "./academic";
import { DEFAULT_ACADEMIC_TIME_ZONE } from "./academic-clock";
import { withV2Db } from "./v2/runtime-database";
import { canonicalIdForLegacy } from "./v2/identity-bridge";
import {
  listV2UserOfferings,
  listV2UserAgenda,
  legacyOfferingIdsForV2User,
} from "./v2/academic-read";
import { academicTimeZoneForUser } from "./v2/academic-timezone";

export function personalPlanningContext(
  userId: number,
  connection: DatabaseConnection = getDatabase(),
) {
  if (process.env.OPENSTUDYHUB_V2_ENABLED === "1")
    return withV2Db((db) => {
      const id = canonicalIdForLegacy(db, userId);
      if (!id)
        return {
          timeZone: DEFAULT_ACADEMIC_TIME_ZONE,
          offerings: [],
          agenda: [],
          canonicalId: null,
        };
      const links = legacyOfferingIdsForV2User(db, id);
      const timeZone = academicTimeZoneForUser(db, id);
      const zones = new Map(
        (
          db
            .prepare(
              "SELECT o.id,t.time_zone zone FROM offerings o JOIN programs p ON p.id=o.program_id LEFT JOIN institution_timezones t ON t.institution_id=p.institution_id JOIN enrollments e ON e.offering_id=o.id AND e.user_id=? AND e.withdrawn_at IS NULL",
            )
            .all(id) as Array<{ id: number; zone: string | null }>
        ).map((r) => [r.id, r.zone ?? timeZone]),
      );
      return {
        timeZone,
        canonicalId: id,
        offerings: listV2UserOfferings(db, id).map((o) => ({
          ...o,
          key: `v2:${o.offeringId}`,
          legacyOfferingId: links.get(o.offeringId) ?? null,
        })),
        agenda: listV2UserAgenda(db, id).map((slot) => ({
          ...slot,
          timeZone: zones.get(slot.offeringId) ?? timeZone,
        })),
      };
    });
  return {
    timeZone: DEFAULT_ACADEMIC_TIME_ZONE,
    canonicalId: null,
    offerings: listUserSubjectOfferings(userId, connection).map((o) => ({
      ...o,
      key: `v1:${o.offeringId}`,
      legacyOfferingId: o.offeringId,
    })),
    agenda: listUserAgenda(userId, connection).map((slot) => ({
      ...slot,
      timeZone: DEFAULT_ACADEMIC_TIME_ZONE,
    })),
  };
}

export type PlanningContext = ReturnType<typeof personalPlanningContext>;
