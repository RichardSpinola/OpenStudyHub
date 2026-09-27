import { z } from "zod";

import type { DatabaseConnection } from "@/lib/db/client";
import { getDatabase } from "@/lib/db/client";

const idSchema = z.number().int().positive();
const requiredTextSchema = z.string().trim().min(1).max(160);
const optionalTextSchema = z
  .string()
  .trim()
  .max(500)
  .optional()
  .nullable()
  .transform((value) => value || null);
const shortTextSchema = z
  .string()
  .trim()
  .max(40)
  .optional()
  .nullable()
  .transform((value) => value || null);

function isIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(value);
}

const isoDateSchema = z.string().refine(isIsoDate, "Invalid ISO date.");
const optionalIsoDateSchema = z
  .string()
  .optional()
  .nullable()
  .transform((value) => value || null)
  .refine((value) => value === null || isIsoDate(value), "Invalid ISO date.");

export function timeToMinutes(value: string): number {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/u.exec(value);
  if (!match) throw new Error("Invalid time.");
  return Number(match[1]) * 60 + Number(match[2]);
}

export const programInputSchema = z.object({
  code: shortTextSchema,
  name: requiredTextSchema,
  shortName: shortTextSchema,
  active: z.boolean().default(true),
});

export const instructorInputSchema = z.object({
  code: shortTextSchema,
  name: requiredTextSchema,
  displayName: shortTextSchema,
  active: z.boolean().default(true),
});

export const subjectInputSchema = z.object({
  code: shortTextSchema,
  name: requiredTextSchema,
  shortName: shortTextSchema,
  active: z.boolean().default(true),
});

export const academicPeriodInputSchema = z
  .object({
    label: z.string().trim().min(1).max(80),
    startsOn: isoDateSchema,
    endsOn: isoDateSchema,
    active: z.boolean().default(true),
  })
  .refine(({ startsOn, endsOn }) => startsOn <= endsOn, {
    message: "Academic period start must not be after its end.",
  });

export const locationInputSchema = z.object({
  name: requiredTextSchema,
  campus: optionalTextSchema,
  building: optionalTextSchema,
  room: shortTextSchema,
  description: optionalTextSchema,
  active: z.boolean().default(true),
});

const offeringStatusSchema = z.enum([
  "planned",
  "active",
  "completed",
  "cancelled",
]);

export const subjectOfferingInputSchema = z.object({
  subjectId: idSchema,
  programId: idSchema,
  academicPeriodId: idSchema,
  instructorId: idSchema
    .optional()
    .nullable()
    .transform((value) => value ?? null),
  classGroup: shortTextSchema,
  curriculumTerm: shortTextSchema,
  status: offeringStatusSchema.default("planned"),
});

export const scheduleSlotInputSchema = z
  .object({
    offeringId: idSchema,
    locationId: idSchema
      .optional()
      .nullable()
      .transform((value) => value ?? null),
    weekday: z.number().int().min(1).max(7),
    startsAtMinutes: z.number().int().min(0).max(1439),
    endsAtMinutes: z.number().int().min(1).max(1440),
    validFrom: optionalIsoDateSchema,
    validUntil: optionalIsoDateSchema,
  })
  .refine(
    ({ startsAtMinutes, endsAtMinutes }) => startsAtMinutes < endsAtMinutes,
    {
      message: "Schedule slot start must be before its end.",
    },
  )
  .refine(
    ({ validFrom, validUntil }) =>
      validFrom === null || validUntil === null || validFrom <= validUntil,
    { message: "Schedule slot validity start must not be after its end." },
  );

const timelineEventTypeSchema = z.enum([
  "class",
  "academic_event",
  "material",
  "other",
]);

export const timelineEventInputSchema = z
  .object({
    offeringId: idSchema,
    locationId: idSchema
      .optional()
      .nullable()
      .transform((value) => value ?? null),
    type: timelineEventTypeSchema,
    title: requiredTextSchema,
    description: optionalTextSchema,
    startsAt: z.coerce.date(),
    endsAt: z.coerce
      .date()
      .optional()
      .nullable()
      .transform((value) => value ?? null),
  })
  .refine(
    ({ startsAt, endsAt }) =>
      endsAt === null || startsAt.getTime() <= endsAt.getTime(),
    { message: "Timeline event start must not be after its end." },
  );

function insertAndGetId(result: { lastInsertRowid: number | bigint }): number {
  return Number(result.lastInsertRowid);
}

export function createProgram(
  input: z.input<typeof programInputSchema>,
  connection: DatabaseConnection = getDatabase(),
) {
  const value = programInputSchema.parse(input);
  const now = Date.now();
  const result = connection.sqlite
    .prepare(
      `insert into programs (code, name, short_name, active, created_at, updated_at)
       values (?, ?, ?, ?, ?, ?)`,
    )
    .run(
      value.code,
      value.name,
      value.shortName,
      Number(value.active),
      now,
      now,
    );

  return { id: insertAndGetId(result), ...value };
}

export function updateProgram(
  id: number,
  input: z.input<typeof programInputSchema>,
  connection: DatabaseConnection = getDatabase(),
) {
  const recordId = idSchema.parse(id);
  const value = programInputSchema.parse(input);
  const result = connection.sqlite
    .prepare(
      `update programs
       set code = ?, name = ?, short_name = ?, active = ?, updated_at = ?
       where id = ?`,
    )
    .run(
      value.code,
      value.name,
      value.shortName,
      Number(value.active),
      Date.now(),
      recordId,
    );
  if (result.changes !== 1) throw new Error("Program not found.");
  return { id: recordId, ...value };
}

export function createInstructor(
  input: z.input<typeof instructorInputSchema>,
  connection: DatabaseConnection = getDatabase(),
) {
  const value = instructorInputSchema.parse(input);
  const now = Date.now();
  const result = connection.sqlite
    .prepare(
      `insert into instructors (code, name, display_name, active, created_at, updated_at)
       values (?, ?, ?, ?, ?, ?)`,
    )
    .run(
      value.code,
      value.name,
      value.displayName,
      Number(value.active),
      now,
      now,
    );

  return { id: insertAndGetId(result), ...value };
}

export function updateInstructor(
  id: number,
  input: z.input<typeof instructorInputSchema>,
  connection: DatabaseConnection = getDatabase(),
) {
  const recordId = idSchema.parse(id);
  const value = instructorInputSchema.parse(input);
  const result = connection.sqlite
    .prepare(
      `update instructors
       set code = ?, name = ?, display_name = ?, active = ?, updated_at = ?
       where id = ?`,
    )
    .run(
      value.code,
      value.name,
      value.displayName,
      Number(value.active),
      Date.now(),
      recordId,
    );
  if (result.changes !== 1) throw new Error("Instructor not found.");
  return { id: recordId, ...value };
}

export function createSubject(
  input: z.input<typeof subjectInputSchema>,
  connection: DatabaseConnection = getDatabase(),
) {
  const value = subjectInputSchema.parse(input);
  const now = Date.now();
  const result = connection.sqlite
    .prepare(
      `insert into subjects (code, name, short_name, active, created_at, updated_at)
       values (?, ?, ?, ?, ?, ?)`,
    )
    .run(
      value.code,
      value.name,
      value.shortName,
      Number(value.active),
      now,
      now,
    );

  return { id: insertAndGetId(result), ...value };
}

export function updateSubject(
  id: number,
  input: z.input<typeof subjectInputSchema>,
  connection: DatabaseConnection = getDatabase(),
) {
  const subjectId = idSchema.parse(id);
  const value = subjectInputSchema.parse(input);
  const result = connection.sqlite
    .prepare(
      `update subjects
       set code = ?, name = ?, short_name = ?, active = ?, updated_at = ?
       where id = ?`,
    )
    .run(
      value.code,
      value.name,
      value.shortName,
      Number(value.active),
      Date.now(),
      subjectId,
    );

  if (result.changes !== 1) throw new Error("Subject not found.");
  return { id: subjectId, ...value };
}

export function deleteSubject(
  id: number,
  connection: DatabaseConnection = getDatabase(),
) {
  const result = connection.sqlite
    .prepare("delete from subjects where id = ?")
    .run(idSchema.parse(id));
  if (result.changes !== 1) throw new Error("Subject not found.");
}

export function createAcademicPeriod(
  input: z.input<typeof academicPeriodInputSchema>,
  connection: DatabaseConnection = getDatabase(),
) {
  const value = academicPeriodInputSchema.parse(input);
  const now = Date.now();
  const result = connection.sqlite
    .prepare(
      `insert into academic_periods (label, starts_on, ends_on, active, created_at, updated_at)
       values (?, ?, ?, ?, ?, ?)`,
    )
    .run(
      value.label,
      value.startsOn,
      value.endsOn,
      Number(value.active),
      now,
      now,
    );

  return { id: insertAndGetId(result), ...value };
}

export function updateAcademicPeriod(
  id: number,
  input: z.input<typeof academicPeriodInputSchema>,
  connection: DatabaseConnection = getDatabase(),
) {
  const recordId = idSchema.parse(id);
  const value = academicPeriodInputSchema.parse(input);
  const result = connection.sqlite
    .prepare(
      `update academic_periods
       set label = ?, starts_on = ?, ends_on = ?, active = ?, updated_at = ?
       where id = ?`,
    )
    .run(
      value.label,
      value.startsOn,
      value.endsOn,
      Number(value.active),
      Date.now(),
      recordId,
    );
  if (result.changes !== 1) throw new Error("Academic period not found.");
  return { id: recordId, ...value };
}

export function createLocation(
  input: z.input<typeof locationInputSchema>,
  connection: DatabaseConnection = getDatabase(),
) {
  const value = locationInputSchema.parse(input);
  const now = Date.now();
  const result = connection.sqlite
    .prepare(
      `insert into locations
       (name, campus, building, room, description, active, created_at, updated_at)
       values (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      value.name,
      value.campus,
      value.building,
      value.room,
      value.description,
      Number(value.active),
      now,
      now,
    );

  return { id: insertAndGetId(result), ...value };
}

export function updateLocation(
  id: number,
  input: z.input<typeof locationInputSchema>,
  connection: DatabaseConnection = getDatabase(),
) {
  const recordId = idSchema.parse(id);
  const value = locationInputSchema.parse(input);
  const result = connection.sqlite
    .prepare(
      `update locations
       set name = ?, campus = ?, building = ?, room = ?, description = ?,
           active = ?, updated_at = ?
       where id = ?`,
    )
    .run(
      value.name,
      value.campus,
      value.building,
      value.room,
      value.description,
      Number(value.active),
      Date.now(),
      recordId,
    );
  if (result.changes !== 1) throw new Error("Location not found.");
  return { id: recordId, ...value };
}

export function createSubjectOffering(
  input: z.input<typeof subjectOfferingInputSchema>,
  connection: DatabaseConnection = getDatabase(),
) {
  const value = subjectOfferingInputSchema.parse(input);
  const now = Date.now();
  const result = connection.sqlite
    .prepare(
      `insert into subject_offerings
       (subject_id, program_id, academic_period_id, instructor_id, class_group,
        curriculum_term, status, created_at, updated_at)
       values (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      value.subjectId,
      value.programId,
      value.academicPeriodId,
      value.instructorId,
      value.classGroup,
      value.curriculumTerm,
      value.status,
      now,
      now,
    );

  return { id: insertAndGetId(result), ...value };
}

export function updateSubjectOffering(
  id: number,
  input: z.input<typeof subjectOfferingInputSchema>,
  connection: DatabaseConnection = getDatabase(),
) {
  const recordId = idSchema.parse(id);
  const value = subjectOfferingInputSchema.parse(input);
  const result = connection.sqlite
    .prepare(
      `update subject_offerings
       set subject_id = ?, program_id = ?, academic_period_id = ?,
           instructor_id = ?, class_group = ?, curriculum_term = ?, status = ?,
           updated_at = ?
       where id = ?`,
    )
    .run(
      value.subjectId,
      value.programId,
      value.academicPeriodId,
      value.instructorId,
      value.classGroup,
      value.curriculumTerm,
      value.status,
      Date.now(),
      recordId,
    );
  if (result.changes !== 1) throw new Error("Offering not found.");
  return { id: recordId, ...value };
}

export function createScheduleSlot(
  input: z.input<typeof scheduleSlotInputSchema>,
  connection: DatabaseConnection = getDatabase(),
) {
  const value = scheduleSlotInputSchema.parse(input);
  const now = Date.now();
  const result = connection.sqlite
    .prepare(
      `insert into schedule_slots
       (offering_id, location_id, weekday, starts_at_minutes, ends_at_minutes,
        valid_from, valid_until, created_at, updated_at)
       values (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      value.offeringId,
      value.locationId,
      value.weekday,
      value.startsAtMinutes,
      value.endsAtMinutes,
      value.validFrom,
      value.validUntil,
      now,
      now,
    );

  return { id: insertAndGetId(result), ...value };
}

export function updateScheduleSlot(
  id: number,
  input: z.input<typeof scheduleSlotInputSchema>,
  connection: DatabaseConnection = getDatabase(),
) {
  const recordId = idSchema.parse(id);
  const value = scheduleSlotInputSchema.parse(input);
  const result = connection.sqlite
    .prepare(
      `update schedule_slots
       set offering_id = ?, location_id = ?, weekday = ?, starts_at_minutes = ?,
           ends_at_minutes = ?, valid_from = ?, valid_until = ?, updated_at = ?
       where id = ?`,
    )
    .run(
      value.offeringId,
      value.locationId,
      value.weekday,
      value.startsAtMinutes,
      value.endsAtMinutes,
      value.validFrom,
      value.validUntil,
      Date.now(),
      recordId,
    );
  if (result.changes !== 1) throw new Error("Schedule slot not found.");
  return { id: recordId, ...value };
}

export function createTimelineEvent(
  input: z.input<typeof timelineEventInputSchema>,
  connection: DatabaseConnection = getDatabase(),
) {
  const value = timelineEventInputSchema.parse(input);
  const now = Date.now();
  const result = connection.sqlite
    .prepare(
      `insert into timeline_events
       (offering_id, location_id, type, title, description, starts_at, ends_at,
        created_at, updated_at)
       values (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      value.offeringId,
      value.locationId,
      value.type,
      value.title,
      value.description,
      value.startsAt.getTime(),
      value.endsAt?.getTime() ?? null,
      now,
      now,
    );

  return { id: insertAndGetId(result), ...value };
}

export function updateTimelineEvent(
  id: number,
  input: z.input<typeof timelineEventInputSchema>,
  connection: DatabaseConnection = getDatabase(),
) {
  const recordId = idSchema.parse(id);
  const value = timelineEventInputSchema.parse(input);
  const result = connection.sqlite
    .prepare(
      `update timeline_events
       set offering_id = ?, location_id = ?, type = ?, title = ?, description = ?,
           starts_at = ?, ends_at = ?, updated_at = ?
       where id = ?`,
    )
    .run(
      value.offeringId,
      value.locationId,
      value.type,
      value.title,
      value.description,
      value.startsAt.getTime(),
      value.endsAt?.getTime() ?? null,
      Date.now(),
      recordId,
    );
  if (result.changes !== 1) throw new Error("Timeline event not found.");
  return { id: recordId, ...value };
}

export type SubjectOfferingSummary = {
  offeringId: number;
  subjectId: number;
  subjectCode: string | null;
  subjectName: string;
  subjectShortName: string | null;
  programName: string;
  programShortName: string | null;
  periodLabel: string;
  instructorName: string | null;
  classGroup: string | null;
  cohortName?: string | null;
  curriculumTerm: string | null;
  status: "planned" | "active" | "completed" | "cancelled";
};

export function listSubjectOfferings(
  connection: DatabaseConnection = getDatabase(),
): SubjectOfferingSummary[] {
  return connection.sqlite
    .prepare(
      `select
         so.id as offeringId,
         s.id as subjectId,
         s.code as subjectCode,
         s.name as subjectName,
         s.short_name as subjectShortName,
         p.name as programName,
         p.short_name as programShortName,
         ap.label as periodLabel,
         coalesce(i.display_name, i.name) as instructorName,
         so.class_group as classGroup,
         so.curriculum_term as curriculumTerm,
         so.status as status
       from subject_offerings so
       join subjects s on s.id = so.subject_id
       join programs p on p.id = so.program_id
       join academic_periods ap on ap.id = so.academic_period_id
       left join instructors i on i.id = so.instructor_id
       where s.active = 1 and p.active = 1 and so.status != 'cancelled'
       order by s.name collate nocase, ap.starts_on desc, so.class_group collate nocase`,
    )
    .all() as SubjectOfferingSummary[];
}

export function listUserSubjectOfferings(
  userId: number,
  connection: DatabaseConnection = getDatabase(),
): SubjectOfferingSummary[] {
  const enrolled = new Set(
    (
      connection.sqlite
        .prepare(
          "select offering_id as offeringId from enrollments where user_id = ?",
        )
        .all(idSchema.parse(userId)) as Array<{ offeringId: number }>
    ).map(({ offeringId }) => offeringId),
  );
  return listSubjectOfferings(connection).filter(({ offeringId }) =>
    enrolled.has(offeringId),
  );
}

export type AgendaSlot = SubjectOfferingSummary & {
  slotId: number;
  weekday: number;
  startsAtMinutes: number;
  endsAtMinutes: number;
  validFrom: string | null;
  validUntil: string | null;
  locationName: string | null;
  campus: string | null;
  building: string | null;
  room: string | null;
};

export const CURRENT_ACADEMIC_PERIOD_SETTING = "academic.current_period_id";

export type CurrentAcademicPeriod = {
  id: number;
  label: string;
  startsOn: string;
  endsOn: string;
};

export function getCurrentAcademicPeriod(
  connection: DatabaseConnection = getDatabase(),
): CurrentAcademicPeriod | null {
  return (
    (connection.sqlite
      .prepare(
        `select
           ap.id as id,
           ap.label as label,
           ap.starts_on as startsOn,
           ap.ends_on as endsOn
         from app_settings setting
         join academic_periods ap
           on ap.id = cast(setting.value as integer)
         where setting.key = ? and ap.active = 1`,
      )
      .get(CURRENT_ACADEMIC_PERIOD_SETTING) as
      CurrentAcademicPeriod | undefined) ?? null
  );
}

export function listAgenda(
  connection: DatabaseConnection = getDatabase(),
): AgendaSlot[] {
  return connection.sqlite
    .prepare(
      `select
         ss.id as slotId,
         ss.weekday as weekday,
         ss.starts_at_minutes as startsAtMinutes,
         ss.ends_at_minutes as endsAtMinutes,
         ss.valid_from as validFrom,
         ss.valid_until as validUntil,
         l.name as locationName,
         l.campus as campus,
         l.building as building,
         l.room as room,
         so.id as offeringId,
         s.id as subjectId,
         s.code as subjectCode,
         s.name as subjectName,
         s.short_name as subjectShortName,
         p.name as programName,
         p.short_name as programShortName,
         ap.label as periodLabel,
         coalesce(i.display_name, i.name) as instructorName,
         so.class_group as classGroup,
         so.curriculum_term as curriculumTerm,
         so.status as status
       from schedule_slots ss
       join subject_offerings so on so.id = ss.offering_id
       join app_settings current_period
         on current_period.key = '${CURRENT_ACADEMIC_PERIOD_SETTING}'
        and so.academic_period_id = cast(current_period.value as integer)
       join subjects s on s.id = so.subject_id
       join programs p on p.id = so.program_id
       join academic_periods ap on ap.id = so.academic_period_id
       left join instructors i on i.id = so.instructor_id
       left join locations l on l.id = ss.location_id
       where s.active = 1 and p.active = 1 and so.status != 'cancelled'
       order by ss.weekday, ss.starts_at_minutes, s.name collate nocase`,
    )
    .all() as AgendaSlot[];
}

export function listUserAgenda(
  userId: number,
  connection: DatabaseConnection = getDatabase(),
): AgendaSlot[] {
  const enrolled = new Set(
    (
      connection.sqlite
        .prepare(
          "select offering_id as offeringId from enrollments where user_id = ?",
        )
        .all(idSchema.parse(userId)) as Array<{ offeringId: number }>
    ).map(({ offeringId }) => offeringId),
  );
  return listAgenda(connection).filter(({ offeringId }) =>
    enrolled.has(offeringId),
  );
}

export type SubjectRecord = {
  id: number;
  code: string | null;
  name: string;
  shortName: string | null;
};

export function listSubjects(
  connection: DatabaseConnection = getDatabase(),
): SubjectRecord[] {
  return connection.sqlite
    .prepare(
      `select id, code, name, short_name as shortName
       from subjects
       where active = 1
       order by name collate nocase, id`,
    )
    .all() as SubjectRecord[];
}

export function listUserSubjects(
  userId: number,
  connection: DatabaseConnection = getDatabase(),
): SubjectRecord[] {
  const subjectIds = new Set(
    listUserSubjectOfferings(userId, connection).map(
      ({ subjectId }) => subjectId,
    ),
  );
  return listSubjects(connection).filter(({ id }) => subjectIds.has(id));
}

export function getSubject(
  id: number,
  connection: DatabaseConnection = getDatabase(),
): SubjectRecord | null {
  return (
    (connection.sqlite
      .prepare(
        `select id, code, name, short_name as shortName
         from subjects where id = ? and active = 1`,
      )
      .get(idSchema.parse(id)) as SubjectRecord | undefined) ?? null
  );
}

export type TimelineEventRecord = {
  id: number;
  offeringId: number;
  type: "class" | "academic_event" | "material" | "other";
  title: string;
  description: string | null;
  startsAt: number;
  endsAt: number | null;
  periodLabel: string;
  programName: string;
  classGroup: string | null;
  locationName: string | null;
};

export function listSubjectTimeline(
  subjectId: number,
  connection: DatabaseConnection = getDatabase(),
): TimelineEventRecord[] {
  return connection.sqlite
    .prepare(
      `select
         te.id as id,
         te.offering_id as offeringId,
         te.type as type,
         te.title as title,
         te.description as description,
         te.starts_at as startsAt,
         te.ends_at as endsAt,
         ap.label as periodLabel,
         p.name as programName,
         so.class_group as classGroup,
         l.name as locationName
       from timeline_events te
       join subject_offerings so on so.id = te.offering_id
       join academic_periods ap on ap.id = so.academic_period_id
       join programs p on p.id = so.program_id
       left join locations l on l.id = te.location_id
       where so.subject_id = ?
       order by te.starts_at, te.id`,
    )
    .all(idSchema.parse(subjectId)) as TimelineEventRecord[];
}

export function listUserSubjectTimeline(
  userId: number,
  subjectId: number,
  connection: DatabaseConnection = getDatabase(),
): TimelineEventRecord[] {
  const enrolled = new Set(
    listUserSubjectOfferings(userId, connection).map(
      ({ offeringId }) => offeringId,
    ),
  );
  return listSubjectTimeline(subjectId, connection).filter(({ offeringId }) =>
    enrolled.has(offeringId),
  );
}
