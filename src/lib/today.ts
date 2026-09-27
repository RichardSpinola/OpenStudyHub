import type { ActivityRecord } from "@/lib/activities";
import type {
  AgendaSlot,
  CurrentAcademicPeriod,
  TimelineEventRecord,
} from "@/lib/academic";
import {
  getCurrentAcademicPeriod,
  listUserAgenda,
  listUserSubjectOfferings,
  listUserSubjectTimeline,
} from "@/lib/academic";
import { listUserActivities } from "@/lib/activities";
import type { DatabaseConnection } from "@/lib/db/client";
import { getDatabase } from "@/lib/db/client";
import { withV2Db } from "@/lib/v2/runtime-database";
import { canonicalIdForLegacy } from "@/lib/v2/identity-bridge";
import {
  getV2UserCurrentPeriod,
  legacyOfferingIdsForV2User,
  listV2UserAgenda,
  listV2UserOfferings,
} from "@/lib/v2/academic-read";

export type TodayData = {
  date: string;
  currentPeriod: CurrentAcademicPeriod | null;
  classes: AgendaSlot[];
  weekSlots: AgendaSlot[];
  upcomingClasses: Array<AgendaSlot & { date: string }>;
  activities: ActivityRecord[];
  upcomingEvents: Array<TimelineEventRecord & { subjectId: number }>;
};

function localIsoDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function getTodayData(
  userId: number,
  now: Date = new Date(),
  connection: DatabaseConnection = getDatabase(),
): TodayData {
  const date = localIsoDate(now);
  const weekday = now.getDay() === 0 ? 7 : now.getDay();
  const v2Context =
    process.env.OPENSTUDYHUB_V2_ENABLED === "1"
      ? withV2Db((db) => {
          const canonicalId = canonicalIdForLegacy(db, userId);
          if (!canonicalId)
            return {
              agenda: [] as AgendaSlot[],
              period: null,
              legacySubjects: new Map<
                number,
                { id: number; name: string; code: string | null }
              >(),
            };
          const links = legacyOfferingIdsForV2User(db, canonicalId);
          const legacySubjects = new Map<
            number,
            { id: number; name: string; code: string | null }
          >();
          for (const offering of listV2UserOfferings(db, canonicalId)) {
            const legacyId = links.get(offering.offeringId);
            if (legacyId)
              legacySubjects.set(legacyId, {
                id: offering.subjectId,
                name: offering.subjectName,
                code: offering.subjectCode,
              });
          }
          return {
            agenda: listV2UserAgenda(db, canonicalId),
            period: getV2UserCurrentPeriod(db, canonicalId, now),
            legacySubjects,
          };
        })
      : null;
  const agenda = v2Context?.agenda ?? listUserAgenda(userId, connection);
  const classes = agenda.filter(
    (slot) =>
      slot.weekday === weekday &&
      (slot.validFrom === null || slot.validFrom <= date) &&
      (slot.validUntil === null || slot.validUntil >= date),
  );
  const upcomingClasses: Array<AgendaSlot & { date: string }> = [];
  for (let offset = 1; offset <= 7; offset += 1) {
    const target = new Date(now);
    target.setDate(now.getDate() + offset);
    const targetDate = localIsoDate(target);
    const targetWeekday = target.getDay() === 0 ? 7 : target.getDay();
    for (const slot of agenda) {
      if (
        slot.weekday === targetWeekday &&
        (slot.validFrom === null || slot.validFrom <= targetDate) &&
        (slot.validUntil === null || slot.validUntil >= targetDate)
      ) {
        upcomingClasses.push({ ...slot, date: targetDate });
      }
    }
  }
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);
  const activities = listUserActivities(userId, connection)
    .flatMap((activity) => {
      if (!v2Context) return [activity];
      const subject = v2Context.legacySubjects.get(activity.offeringId);
      return subject
        ? [
            {
              ...activity,
              subjectId: subject.id,
              subjectName: subject.name,
              subjectCode: subject.code,
            },
          ]
        : [];
    })
    .filter(
      ({ dueAt, status }) =>
        dueAt !== null &&
        dueAt >= startOfToday.getTime() - 7 * 24 * 60 * 60 * 1000 &&
        dueAt <= now.getTime() + 7 * 24 * 60 * 60 * 1000 &&
        !["completed", "submitted", "archived"].includes(status),
    )
    .slice(0, 12);
  const subjectIds = [
    ...new Set(
      listUserSubjectOfferings(userId, connection)
        .filter(
          ({ offeringId }) =>
            !v2Context || v2Context.legacySubjects.has(offeringId),
        )
        .map((item) => item.subjectId),
    ),
  ];
  const upcomingEvents = subjectIds
    .flatMap((subjectId) =>
      listUserSubjectTimeline(userId, subjectId, connection)
        .filter(
          (item) =>
            item.type === "academic_event" &&
            (!v2Context || v2Context.legacySubjects.has(item.offeringId)) &&
            item.startsAt >= now.getTime() &&
            item.startsAt <= now.getTime() + 7 * 86400000,
        )
        .map((item) => ({
          ...item,
          subjectId:
            v2Context?.legacySubjects.get(item.offeringId)?.id ?? subjectId,
        })),
    )
    .sort((a, b) => a.startsAt - b.startsAt)
    .slice(0, 6);
  return {
    date,
    currentPeriod:
      v2Context?.period ??
      (v2Context ? null : getCurrentAcademicPeriod(connection)),
    classes,
    weekSlots: agenda,
    upcomingClasses,
    activities,
    upcomingEvents,
  };
}
