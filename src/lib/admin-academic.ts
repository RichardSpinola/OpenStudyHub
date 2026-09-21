import { z } from "zod";

import { assertActiveAdmin } from "@/lib/access";
import {
  CURRENT_ACADEMIC_PERIOD_SETTING,
  type CurrentAcademicPeriod,
} from "@/lib/academic";
import { recordAuditEvent } from "@/lib/audit";
import type { DatabaseConnection } from "@/lib/db/client";
import { getDatabase } from "@/lib/db/client";

export type AdminCatalogRecord = {
  id: number;
  code?: string | null;
  name: string;
  shortName?: string | null;
  displayName?: string | null;
  active: number;
};

export type AdminAcademicPeriod = CurrentAcademicPeriod & { active: number };
export type AdminLocation = AdminCatalogRecord & {
  campus: string | null;
  building: string | null;
  room: string | null;
  description: string | null;
};
export type AdminOffering = {
  id: number;
  subjectId: number;
  programId: number;
  academicPeriodId: number;
  instructorId: number | null;
  classGroup: string | null;
  curriculumTerm: string | null;
  status: "planned" | "active" | "completed" | "cancelled";
};
export type AdminScheduleSlot = {
  id: number;
  offeringId: number;
  locationId: number | null;
  weekday: number;
  startsAtMinutes: number;
  endsAtMinutes: number;
  validFrom: string | null;
  validUntil: string | null;
};
export type AdminTimelineEvent = {
  id: number;
  offeringId: number;
  locationId: number | null;
  type: "class" | "academic_event" | "material" | "other";
  title: string;
  description: string | null;
  startsAt: number;
  endsAt: number | null;
};

export type AdminAcademicData = {
  programs: AdminCatalogRecord[];
  instructors: AdminCatalogRecord[];
  periods: AdminAcademicPeriod[];
  locations: AdminLocation[];
  subjects: AdminCatalogRecord[];
  offerings: AdminOffering[];
  scheduleSlots: AdminScheduleSlot[];
  timelineEvents: AdminTimelineEvent[];
  currentPeriodId: number | null;
};

export function getAdminAcademicData(
  connection: DatabaseConnection = getDatabase(),
): AdminAcademicData {
  const current = connection.sqlite
    .prepare("select value from app_settings where key = ?")
    .get(CURRENT_ACADEMIC_PERIOD_SETTING) as { value: string } | undefined;
  const parsedCurrent = current ? Number(current.value) : NaN;

  return {
    programs: connection.sqlite
      .prepare(
        "select id, code, name, short_name as shortName, active from programs order by name collate nocase",
      )
      .all() as AdminCatalogRecord[],
    instructors: connection.sqlite
      .prepare(
        "select id, code, name, display_name as displayName, active from instructors order by name collate nocase",
      )
      .all() as AdminCatalogRecord[],
    periods: connection.sqlite
      .prepare(
        "select id, label, starts_on as startsOn, ends_on as endsOn, active from academic_periods order by starts_on desc, id desc",
      )
      .all() as AdminAcademicPeriod[],
    locations: connection.sqlite
      .prepare(
        "select id, name, campus, building, room, description, active from locations order by name collate nocase",
      )
      .all() as AdminLocation[],
    subjects: connection.sqlite
      .prepare(
        "select id, code, name, short_name as shortName, active from subjects order by name collate nocase",
      )
      .all() as AdminCatalogRecord[],
    offerings: connection.sqlite
      .prepare(
        `select id, subject_id as subjectId, program_id as programId,
                academic_period_id as academicPeriodId,
                instructor_id as instructorId, class_group as classGroup,
                curriculum_term as curriculumTerm, status
         from subject_offerings order by academic_period_id desc, id`,
      )
      .all() as AdminOffering[],
    scheduleSlots: connection.sqlite
      .prepare(
        `select id, offering_id as offeringId, location_id as locationId,
                weekday, starts_at_minutes as startsAtMinutes,
                ends_at_minutes as endsAtMinutes, valid_from as validFrom,
                valid_until as validUntil
         from schedule_slots order by weekday, starts_at_minutes, id`,
      )
      .all() as AdminScheduleSlot[],
    timelineEvents: connection.sqlite
      .prepare(
        `select id, offering_id as offeringId, location_id as locationId,
                type, title, description, starts_at as startsAt, ends_at as endsAt
         from timeline_events order by starts_at, id`,
      )
      .all() as AdminTimelineEvent[],
    currentPeriodId: Number.isInteger(parsedCurrent) ? parsedCurrent : null,
  };
}

export function runAuditedAcademicMutation<T extends { id: number }>(
  actorUserId: number,
  action: string,
  targetType: string,
  mutation: (connection: DatabaseConnection) => T,
  connection: DatabaseConnection = getDatabase(),
): T {
  return runAuthorizedAcademicMutation(
    actorUserId,
    action,
    targetType,
    (activeConnection) => assertActiveAdmin(actorUserId, activeConnection),
    mutation,
    connection,
  );
}

export function runAuthorizedAcademicMutation<T extends { id: number }>(
  actorUserId: number,
  action: string,
  targetType: string,
  authorize: (connection: DatabaseConnection) => void,
  mutation: (connection: DatabaseConnection) => T,
  connection: DatabaseConnection = getDatabase(),
): T {
  const operation = connection.sqlite.transaction(() => {
    authorize(connection);
    const result = mutation(connection);
    recordAuditEvent(
      {
        actorUserId,
        action,
        targetType,
        targetId: String(result.id),
        summary: null,
      },
      connection,
    );
    return result;
  });
  return operation.immediate();
}

export function setCurrentAcademicPeriod(
  actorUserId: number,
  periodIdInput: number,
  connection: DatabaseConnection = getDatabase(),
): void {
  const periodId = z.number().int().positive().parse(periodIdInput);
  const operation = connection.sqlite.transaction(() => {
    assertActiveAdmin(actorUserId, connection);
    const period = connection.sqlite
      .prepare("select id from academic_periods where id = ? and active = 1")
      .get(periodId) as { id: number } | undefined;
    if (!period) throw new Error("Academic period not found or inactive.");
    connection.sqlite
      .prepare(
        `insert into app_settings (key, value, updated_at)
         values (?, ?, ?)
         on conflict(key) do update set
           value = excluded.value,
           updated_at = excluded.updated_at`,
      )
      .run(CURRENT_ACADEMIC_PERIOD_SETTING, String(periodId), Date.now());
    recordAuditEvent(
      {
        actorUserId,
        action: "academic.current_period_change",
        targetType: "academic_period",
        targetId: String(periodId),
        summary: "current academic period selected",
      },
      connection,
    );
  });
  operation.immediate();
}
