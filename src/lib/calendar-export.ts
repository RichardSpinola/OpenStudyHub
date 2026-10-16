import { createHash } from "node:crypto";
import { getDatabase, type DatabaseConnection } from "./db/client";
import { personalPlanningContext } from "./personal-planning-context";
import {
  academicClock,
  academicLocalDateTime,
  academicMidnight,
  addAcademicDays,
  validCalendarDate,
} from "./academic-clock";
import { listUserActivities } from "./activities";
import { listUserSubjectTimeline } from "./academic";
import { listPersonalTasks } from "./personal-tasks";
import { withV2Db } from "./v2/runtime-database";
import { userAcademicEvents } from "./v2/academic-events";
import { joinLocation } from "./academic-format";

export const calendarKinds = [
  "classes",
  "events",
  "deadlines",
  "tasks",
] as const;
export type CalendarKind = (typeof calendarKinds)[number];
export type CalendarEntry = {
  key: string;
  title: string;
  description?: string | null;
  location?: string | null;
  startsAt: number;
  endsAt?: number | null;
  updatedAt?: number;
  url?: string;
};
export function calendarRange(from: string, until: string, timeZone: string) {
  if (
    !validCalendarDate(from) ||
    !validCalendarDate(until) ||
    until < from ||
    Date.parse(until) - Date.parse(from) > 365 * 86400000
  )
    throw new Error("range");
  return {
    start: academicMidnight(from, timeZone),
    end: academicMidnight(addAcademicDays(until, 1), timeZone),
  };
}
export function collectCalendarEntries(
  userId: number,
  from: string,
  until: string,
  kinds: CalendarKind[],
  connection: DatabaseConnection = getDatabase(),
) {
  if (!kinds.length || kinds.some((k) => !calendarKinds.includes(k)))
    throw new Error("kinds");
  const ctx = personalPlanningContext(userId, connection),
    range = calendarRange(from, until, ctx.timeZone);
  const entries: CalendarEntry[] = [];
  function add(entry: CalendarEntry) {
    if (entries.length >= 10000) throw new Error("limit");
    entries.push(entry);
  }
  const minuteInput = (date: string, minutes: number) =>
    `${date}T${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
  if (kinds.includes("classes"))
    for (let date = from; date <= until; date = addAcademicDays(date, 1)) {
      const weekday = new Date(date + "T00:00:00Z").getUTCDay() || 7;
      for (const slot of ctx.agenda) {
        if (
          slot.weekday !== weekday ||
          (slot.validFrom && date < slot.validFrom) ||
          (slot.validUntil && date > slot.validUntil)
        )
          continue;
        add({
          key: `class-${process.env.OPENSTUDYHUB_V2_ENABLED === "1" ? "v2" : "v1"}-${slot.slotId}-${date}`,
          title: slot.subjectName,
          location: joinLocation([
            slot.locationName,
            slot.campus,
            slot.building,
            slot.room,
          ]),
          description: [slot.periodLabel, slot.instructorName]
            .filter(Boolean)
            .join(" · "),
          startsAt: academicLocalDateTime(
            minuteInput(date, slot.startsAtMinutes),
            slot.timeZone,
          ).getTime(),
          endsAt:
            slot.endsAtMinutes === 1440
              ? academicMidnight(addAcademicDays(date, 1), slot.timeZone)
              : academicLocalDateTime(
                  minuteInput(date, slot.endsAtMinutes),
                  slot.timeZone,
                ).getTime(),
        });
      }
    }
  if (ctx.canonicalId !== null) {
    const events = withV2Db((db) =>
      userAcademicEvents(db, ctx.canonicalId!, range.start, range.end),
    );
    for (const e of events)
      if (
        (e.kind === "class"
          ? kinds.includes("classes")
          : kinds.includes("events")) &&
        e.startsAt < range.end
      )
        add({
          key: `event-v2-${e.id}`,
          title: e.title,
          description: e.description,
          startsAt: e.startsAt,
          endsAt: e.endsAt,
        });
  } else if (
    process.env.OPENSTUDYHUB_V2_ENABLED !== "1" &&
    kinds.includes("events")
  ) {
    for (const subjectId of new Set(ctx.offerings.map((o) => o.subjectId)))
      for (const e of listUserSubjectTimeline(userId, subjectId, connection)) {
        if (
          e.type !== "academic_event" ||
          e.startsAt >= range.end ||
          (e.endsAt ?? e.startsAt) < range.start
        )
          continue;
        add({
          key: `event-v1-${e.id}`,
          title: e.title,
          description: e.description,
          location: e.locationName,
          startsAt: e.startsAt,
          endsAt: e.endsAt,
        });
      }
  }
  if (kinds.includes("deadlines")) {
    const allowed = new Set(ctx.offerings.map((o) => o.legacyOfferingId));
    for (const a of listUserActivities(userId, connection)) {
      if (
        !allowed.has(a.offeringId) ||
        a.origin !== "external" ||
        a.dueAt === null ||
        a.dueAt < range.start ||
        a.dueAt >= range.end ||
        ["completed", "submitted", "archived"].includes(a.status)
      )
        continue;
      add({
        key: `deadline-${a.id}`,
        title: a.title,
        description: a.description,
        startsAt: a.dueAt,
        updatedAt: a.updatedAt,
        url: a.externalUrl ?? undefined,
      });
    }
  }
  if (kinds.includes("tasks"))
    for (const t of listPersonalTasks(userId, connection)) {
      if (
        t.completedAt !== null ||
        t.dueAt === null ||
        t.dueAt < range.start ||
        t.dueAt >= range.end
      )
        continue;
      add({
        key: `task-${t.id}`,
        title: t.title,
        description: t.description,
        startsAt: t.dueAt,
        updatedAt: t.updatedAt,
      });
    }
  return {
    entries: entries.sort(
      (a, b) => a.startsAt - b.startsAt || a.key.localeCompare(b.key),
    ),
    timeZone: ctx.timeZone,
  };
}

const stamp = (epoch: number) =>
  new Date(epoch)
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}Z$/, "Z");
function escapeText(value: string) {
  return value
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "")
    .replace(/\\/g, "\\\\")
    .replace(/\r\n|\r|\n/g, "\\n")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,");
}
// RFC 5545 §3.1: fold at 75 octets without splitting a UTF-8 character.
export function foldCalendarLine(value: string) {
  const lines: string[] = [];
  let line = "",
    size = 0;
  for (const char of value) {
    const bytes = Buffer.byteLength(char);
    if (size + bytes > 75) {
      lines.push(line);
      line = " ";
      size = 1;
    }
    line += char;
    size += bytes;
  }
  lines.push(line);
  return lines.join("\r\n");
}
export function serializeCalendar(
  entries: CalendarEntry[],
  userId: number,
  instance: string,
  now = Date.now(),
) {
  const origin = new URL(instance).origin;
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//OpenStudyHub//Personal Calendar//PT",
    "CALSCALE:GREGORIAN",
  ];
  for (const e of entries) {
    const uid =
      createHash("sha256")
        .update(`${origin}|${userId}|${e.key}`)
        .digest("hex")
        .slice(0, 40) + "@openstudyhub";
    lines.push(
      "BEGIN:VEVENT",
      `UID:${uid}`,
      `DTSTAMP:${stamp(now)}`,
      `DTSTART:${stamp(e.startsAt)}`,
      `DTEND:${stamp(e.endsAt && e.endsAt > e.startsAt ? e.endsAt : e.startsAt + 60000)}`,
      `SUMMARY:${escapeText(e.title)}`,
      "CLASS:PRIVATE",
    );
    if (e.description) lines.push(`DESCRIPTION:${escapeText(e.description)}`);
    if (e.location) lines.push(`LOCATION:${escapeText(e.location)}`);
    if (e.updatedAt) lines.push(`LAST-MODIFIED:${stamp(e.updatedAt)}`);
    if (e.url) {
      try {
        const url = new URL(e.url);
        if (url.protocol === "https:") lines.push(`URL:${url.href}`);
      } catch {
        /* No malformed external link is exported. */
      }
    }
    lines.push("END:VEVENT");
  }
  lines.push("END:VCALENDAR");
  return lines.map(foldCalendarLine).join("\r\n") + "\r\n";
}
export function defaultCalendarRange(timeZone: string) {
  const from = academicClock(new Date(), timeZone).date;
  return { from, until: addAcademicDays(from, 30) };
}
