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
  const agenda = listUserAgenda(userId, connection);
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
      listUserSubjectOfferings(userId, connection).map(
        (item) => item.subjectId,
      ),
    ),
  ];
  const upcomingEvents = subjectIds
    .flatMap((subjectId) =>
      listUserSubjectTimeline(userId, subjectId, connection)
        .filter(
          (item) =>
            item.type === "academic_event" &&
            item.startsAt >= now.getTime() &&
            item.startsAt <= now.getTime() + 7 * 86400000,
        )
        .map((item) => ({ ...item, subjectId })),
    )
    .sort((a, b) => a.startsAt - b.startsAt)
    .slice(0, 6);
  return {
    date,
    currentPeriod: getCurrentAcademicPeriod(connection),
    classes,
    weekSlots: agenda,
    upcomingClasses,
    activities,
    upcomingEvents,
  };
}
