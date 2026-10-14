import { academicClock } from "../academic-clock";
import { withV2Db } from "./runtime-database";
import { userAcademicEvents } from "./academic-events";
import { listV2UserOfferings } from "./academic-read";
import { canonicalIdForLegacy } from "./identity-bridge";
import type { SubjectFeedItem } from "../subject-feed";
export function academicEventsForLegacyUser(id: number) {
  return withV2Db((db) => {
    const userId = canonicalIdForLegacy(db, id);
    if (!userId) return [];
    const offers = listV2UserOfferings(db, userId);
    return userAcademicEvents(db, userId).map((e) => {
      const offer = e.offeringId
        ? offers.find((o) => o.offeringId === e.offeringId)
        : e.programId
          ? offers.find((o) =>
              db
                .prepare("SELECT 1 FROM offerings WHERE id=? AND program_id=?")
                .get(o.offeringId, e.programId),
            )
          : undefined;
      return {
        id: e.id,
        offeringId: e.offeringId ?? 0,
        type: "academic_event" as const,
        title: e.title,
        description: e.description || null,
        startsAt: e.startsAt,
        endsAt: e.endsAt,
        periodLabel: offer?.periodLabel ?? "",
        programName:
          e.kind === "class"
            ? "Aula excepcional"
            : e.kind === "exam"
              ? "Prova"
              : "Evento acadêmico",
        classGroup: null,
        locationName: null,
        subjectId: offer?.subjectId ?? 0,
      };
    });
  });
}
export function subjectEventFeed(
  legacyId: number,
  subjectId: number,
): SubjectFeedItem[] {
  return withV2Db((db) => {
    const userId = canonicalIdForLegacy(db, legacyId);
    if (!userId) return [];
    const offers = listV2UserOfferings(db, userId).filter(
      (o) => o.subjectId === subjectId,
    );
    return userAcademicEvents(db, userId)
      .filter((e) =>
        offers.some((o) =>
          db
            .prepare(
              "SELECT 1 FROM offerings o JOIN programs p ON p.id=o.program_id WHERE o.id=? AND p.institution_id=? AND (? IS NULL OR o.program_id=?) AND (? IS NULL OR o.id=?)",
            )
            .get(
              o.offeringId,
              e.institutionId,
              e.programId,
              e.programId,
              e.offeringId,
              e.offeringId,
            ),
        ),
      )
      .map((e) => ({
        key: "v3-event-" + e.id,
        kind: "academic_event" as const,
        title: e.title,
        description: e.description || null,
        occurredAt: e.startsAt,
        relevantAt: e.startsAt,
        href: null,
        external: false,
        sourceLabel:
          e.kind === "class"
            ? "Aula excepcional"
            : e.kind === "exam"
              ? "Prova"
              : "Evento acadêmico",
        status: null,
      }));
  });
}
export function exceptionalClassesForLegacyUser(id: number) {
  return withV2Db((db) => {
    const userId = canonicalIdForLegacy(db, id);
    if (!userId) return [];
    const offers = listV2UserOfferings(db, userId);
    return userAcademicEvents(db, userId)
      .filter((e) => e.kind === "class" && e.offeringId)
      .flatMap((e) => {
        const offer = offers.find((o) => o.offeringId === e.offeringId);
        if (!offer) return [];
        const zone =
          (
            db
              .prepare(
                "SELECT time_zone z FROM institution_timezones WHERE institution_id=?",
              )
              .get(e.institutionId) as { z: string } | undefined
          )?.z ?? "America/Bahia";
        const start = academicClock(new Date(e.startsAt), zone),
          end = academicClock(new Date(e.endsAt), zone);
        return [
          {
            ...offer,
            slotId: -e.id,
            weekday: start.weekday,
            startsAtMinutes: start.minutes,
            endsAtMinutes: start.date === end.date ? end.minutes : 1440,
            validFrom: start.date,
            validUntil: start.date,
            locationName: null,
            campus: null,
            building: null,
            room: null,
            date: start.date,
          },
        ];
      });
  });
}
