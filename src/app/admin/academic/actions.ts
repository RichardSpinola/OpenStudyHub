"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import {
  createAcademicPeriod,
  createInstructor,
  createLocation,
  createProgram,
  createScheduleSlot,
  createSubject,
  createSubjectOffering,
  createTimelineEvent,
  timeToMinutes,
  updateAcademicPeriod,
  updateInstructor,
  updateLocation,
  updateProgram,
  updateScheduleSlot,
  updateSubject,
  updateSubjectOffering,
  updateTimelineEvent,
} from "@/lib/academic";
import {
  runAuthorizedAcademicMutation,
  runAuditedAcademicMutation,
  setCurrentAcademicPeriod,
} from "@/lib/admin-academic";
import {
  requireAcademicAdministrator,
  requireAdminUser,
} from "@/lib/authorization";
import type { DatabaseConnection } from "@/lib/db/client";
import { createCohort, updateCohort } from "@/lib/academic-membership";
import {
  assertCanManageOffering,
  assertCanManageProgram,
  assertCanManageScheduleSlot,
} from "@/lib/academic-authority";
import { getClassroomCourse } from "@/lib/google/classroom";
import { createOfferingDriveFolder } from "@/lib/google/drive";
import {
  getOfferingGoogleIntegration,
  updateOfferingGoogleIntegration,
} from "@/lib/google/offering-integrations";
import { getDatabase } from "@/lib/db/client";

const idSchema = z.coerce.number().int().positive();

function field(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

function optionalField(formData: FormData, name: string): string | null {
  return field(formData, name).trim() || null;
}

function optionalId(formData: FormData, name: string): number | null {
  const value = field(formData, name);
  return value ? idSchema.parse(value) : null;
}

function activeField(formData: FormData): boolean {
  return formData.get("active") === "on";
}

async function academicMutation(
  formData: FormData,
  action: string,
  targetType: string,
  mutation: (connection: DatabaseConnection) => { id: number },
) {
  const actor = await requireAdminUser();
  let ok = true;
  try {
    runAuditedAcademicMutation(actor.id, action, targetType, mutation);
  } catch {
    ok = false;
  }
  redirect(`/admin/academic?status=${ok ? "ok" : "error"}`);
}

async function scopedAcademicMutation(
  actorUserId: number,
  action: string,
  targetType: string,
  authorize: (actorUserId: number, connection: DatabaseConnection) => void,
  mutation: (connection: DatabaseConnection) => { id: number },
) {
  let ok = true;
  try {
    runAuthorizedAcademicMutation(
      actorUserId,
      action,
      targetType,
      (connection) => authorize(actorUserId, connection),
      mutation,
    );
  } catch {
    ok = false;
  }
  redirect(`/admin/academic?status=${ok ? "ok" : "error"}`);
}

function programInput(formData: FormData) {
  return {
    code: optionalField(formData, "code"),
    name: field(formData, "name"),
    shortName: optionalField(formData, "shortName"),
    active: activeField(formData),
  };
}

export async function createProgramAction(formData: FormData) {
  return academicMutation(
    formData,
    "academic.program_create",
    "program",
    (connection) => createProgram(programInput(formData), connection),
  );
}

export async function updateProgramAction(formData: FormData) {
  return academicMutation(
    formData,
    "academic.program_update",
    "program",
    (connection) =>
      updateProgram(
        idSchema.parse(formData.get("id")),
        programInput(formData),
        connection,
      ),
  );
}

function cohortInput(formData: FormData) {
  return {
    programId: idSchema.parse(formData.get("programId")),
    code: optionalField(formData, "code"),
    name: field(formData, "name"),
    active: activeField(formData),
  };
}

export async function createCohortAction(formData: FormData) {
  const actor = await requireAcademicAdministrator();
  let ok = true;
  try {
    createCohort(actor.id, cohortInput(formData));
  } catch {
    ok = false;
  }
  redirect(`/admin/academic?status=${ok ? "ok" : "error"}`);
}

export async function updateCohortAction(formData: FormData) {
  const actor = await requireAcademicAdministrator();
  let ok = true;
  try {
    updateCohort(
      actor.id,
      idSchema.parse(formData.get("id")),
      cohortInput(formData),
    );
  } catch {
    ok = false;
  }
  redirect(`/admin/academic?status=${ok ? "ok" : "error"}`);
}

function instructorInput(formData: FormData) {
  return {
    code: optionalField(formData, "code"),
    name: field(formData, "name"),
    displayName: optionalField(formData, "displayName"),
    active: activeField(formData),
  };
}

export async function createInstructorAction(formData: FormData) {
  return academicMutation(
    formData,
    "academic.instructor_create",
    "instructor",
    (connection) => createInstructor(instructorInput(formData), connection),
  );
}

export async function updateInstructorAction(formData: FormData) {
  return academicMutation(
    formData,
    "academic.instructor_update",
    "instructor",
    (connection) =>
      updateInstructor(
        idSchema.parse(formData.get("id")),
        instructorInput(formData),
        connection,
      ),
  );
}

function periodInput(formData: FormData) {
  return {
    label: field(formData, "label"),
    startsOn: field(formData, "startsOn"),
    endsOn: field(formData, "endsOn"),
    active: activeField(formData),
  };
}

export async function createPeriodAction(formData: FormData) {
  return academicMutation(
    formData,
    "academic.period_create",
    "academic_period",
    (connection) => createAcademicPeriod(periodInput(formData), connection),
  );
}

export async function updatePeriodAction(formData: FormData) {
  return academicMutation(
    formData,
    "academic.period_update",
    "academic_period",
    (connection) =>
      updateAcademicPeriod(
        idSchema.parse(formData.get("id")),
        periodInput(formData),
        connection,
      ),
  );
}

function locationInput(formData: FormData) {
  return {
    name: field(formData, "name"),
    campus: optionalField(formData, "campus"),
    building: optionalField(formData, "building"),
    room: optionalField(formData, "room"),
    description: optionalField(formData, "description"),
    active: activeField(formData),
  };
}

export async function createLocationAction(formData: FormData) {
  return academicMutation(
    formData,
    "academic.location_create",
    "location",
    (connection) => createLocation(locationInput(formData), connection),
  );
}

export async function updateLocationAction(formData: FormData) {
  return academicMutation(
    formData,
    "academic.location_update",
    "location",
    (connection) =>
      updateLocation(
        idSchema.parse(formData.get("id")),
        locationInput(formData),
        connection,
      ),
  );
}

function subjectInput(formData: FormData) {
  return {
    code: optionalField(formData, "code"),
    name: field(formData, "name"),
    shortName: optionalField(formData, "shortName"),
    active: activeField(formData),
  };
}

export async function createSubjectAction(formData: FormData) {
  return academicMutation(
    formData,
    "academic.subject_create",
    "subject",
    (connection) => createSubject(subjectInput(formData), connection),
  );
}

export async function updateSubjectAction(formData: FormData) {
  return academicMutation(
    formData,
    "academic.subject_update",
    "subject",
    (connection) =>
      updateSubject(
        idSchema.parse(formData.get("id")),
        subjectInput(formData),
        connection,
      ),
  );
}

function offeringInput(formData: FormData) {
  return {
    subjectId: idSchema.parse(formData.get("subjectId")),
    programId: idSchema.parse(formData.get("programId")),
    academicPeriodId: idSchema.parse(formData.get("academicPeriodId")),
    instructorId: optionalId(formData, "instructorId"),
    classGroup: optionalField(formData, "classGroup"),
    curriculumTerm: optionalField(formData, "curriculumTerm"),
    status: field(formData, "status") as
      "planned" | "active" | "completed" | "cancelled",
  };
}

export async function createOfferingAction(formData: FormData) {
  const actor = await requireAcademicAdministrator();
  const input = offeringInput(formData);
  return scopedAcademicMutation(
    actor.id,
    "academic.offering_create",
    "subject_offering",
    (actorUserId, connection) =>
      assertCanManageProgram(actorUserId, input.programId, connection),
    (connection) => createSubjectOffering(input, connection),
  );
}

export async function updateOfferingAction(formData: FormData) {
  const actor = await requireAcademicAdministrator();
  const offeringId = idSchema.parse(formData.get("id"));
  const input = offeringInput(formData);
  return scopedAcademicMutation(
    actor.id,
    "academic.offering_update",
    "subject_offering",
    (actorUserId, connection) => {
      assertCanManageOffering(actorUserId, offeringId, connection);
      assertCanManageProgram(actorUserId, input.programId, connection);
    },
    (connection) => updateSubjectOffering(offeringId, input, connection),
  );
}

function scheduleInput(formData: FormData) {
  return {
    offeringId: idSchema.parse(formData.get("offeringId")),
    locationId: optionalId(formData, "locationId"),
    weekday: z.coerce
      .number()
      .int()
      .min(1)
      .max(7)
      .parse(formData.get("weekday")),
    startsAtMinutes: timeToMinutes(field(formData, "startsAt")),
    endsAtMinutes: timeToMinutes(field(formData, "endsAt")),
    validFrom: optionalField(formData, "validFrom"),
    validUntil: optionalField(formData, "validUntil"),
  };
}

export async function createScheduleAction(formData: FormData) {
  const actor = await requireAcademicAdministrator();
  const input = scheduleInput(formData);
  return scopedAcademicMutation(
    actor.id,
    "academic.schedule_create",
    "schedule_slot",
    (actorUserId, connection) =>
      assertCanManageOffering(actorUserId, input.offeringId, connection),
    (connection) => createScheduleSlot(input, connection),
  );
}

export async function updateScheduleAction(formData: FormData) {
  const actor = await requireAcademicAdministrator();
  const scheduleId = idSchema.parse(formData.get("id"));
  const input = scheduleInput(formData);
  return scopedAcademicMutation(
    actor.id,
    "academic.schedule_update",
    "schedule_slot",
    (actorUserId, connection) => {
      assertCanManageScheduleSlot(actorUserId, scheduleId, connection);
      assertCanManageOffering(actorUserId, input.offeringId, connection);
    },
    (connection) => updateScheduleSlot(scheduleId, input, connection),
  );
}

function timelineInput(formData: FormData) {
  return {
    offeringId: idSchema.parse(formData.get("offeringId")),
    locationId: optionalId(formData, "locationId"),
    type: field(formData, "type") as
      "class" | "academic_event" | "material" | "other",
    title: field(formData, "title"),
    description: optionalField(formData, "description"),
    startsAt: field(formData, "startsAt"),
    endsAt: optionalField(formData, "endsAt"),
  };
}

export async function createTimelineAction(formData: FormData) {
  return academicMutation(
    formData,
    "academic.timeline_create",
    "timeline_event",
    (connection) => createTimelineEvent(timelineInput(formData), connection),
  );
}

export async function updateTimelineAction(formData: FormData) {
  return academicMutation(
    formData,
    "academic.timeline_update",
    "timeline_event",
    (connection) =>
      updateTimelineEvent(
        idSchema.parse(formData.get("id")),
        timelineInput(formData),
        connection,
      ),
  );
}

export async function setCurrentPeriodAction(formData: FormData) {
  const actor = await requireAdminUser();
  let ok = true;
  try {
    setCurrentAcademicPeriod(
      actor.id,
      idSchema.parse(formData.get("periodId")),
    );
  } catch {
    ok = false;
  }
  redirect(`/admin/academic?status=${ok ? "ok" : "error"}`);
}

export async function updateNotebookIntegrationAction(formData: FormData) {
  const actor = await requireAcademicAdministrator();
  let ok = true;
  try {
    const connection = getDatabase();
    const offeringId = idSchema.parse(formData.get("offeringId"));
    const current = getOfferingGoogleIntegration(offeringId, connection);
    updateOfferingGoogleIntegration(
      actor.id,
      offeringId,
      {
        notebookUrl: optionalField(formData, "notebookUrl"),
        classroomCourseId: current?.classroomCourseId ?? null,
        classroomCourseName: current?.classroomCourseName ?? null,
      },
      connection,
    );
  } catch {
    ok = false;
  }
  redirect(`/admin/academic?status=${ok ? "ok" : "error"}`);
}

export async function updateClassroomIntegrationAction(formData: FormData) {
  const actor = await requireAcademicAdministrator();
  let ok = true;
  try {
    const connection = getDatabase();
    const offeringId = idSchema.parse(formData.get("offeringId"));
    assertCanManageOffering(actor.id, offeringId, connection);
    const current = getOfferingGoogleIntegration(offeringId, connection);
    const manualClassroomCourseId = optionalField(
      formData,
      "manualClassroomCourseId",
    );
    const manualClassroomCourseName = optionalField(
      formData,
      "manualClassroomCourseName",
    );
    const classroomCourseId = optionalField(formData, "classroomCourseId");
    let mappedCourseId: string | null = null;
    let mappedCourseName: string | null = null;

    if (manualClassroomCourseId) {
      if (!manualClassroomCourseName) {
        throw new Error("Manual Classroom mapping requires a course name.");
      }
      mappedCourseId = manualClassroomCourseId;
      mappedCourseName = manualClassroomCourseName;
    } else if (classroomCourseId) {
      const course = await getClassroomCourse(actor.id, classroomCourseId, {
        connection,
      });
      mappedCourseId = course.id;
      mappedCourseName = course.name;
    }
    updateOfferingGoogleIntegration(
      actor.id,
      offeringId,
      {
        notebookUrl: current?.notebookUrl ?? null,
        classroomCourseId: mappedCourseId,
        classroomCourseName: mappedCourseName,
      },
      connection,
    );
  } catch {
    ok = false;
  }
  redirect(`/admin/academic?status=${ok ? "ok" : "error"}`);
}

export async function createDriveFolderAction(formData: FormData) {
  const actor = await requireAcademicAdministrator();
  let ok = true;
  try {
    await createOfferingDriveFolder(
      actor.id,
      idSchema.parse(formData.get("offeringId")),
      { forceReprovision: formData.get("forceReprovision") === "true" },
    );
  } catch {
    ok = false;
  }
  redirect(`/admin/academic?status=${ok ? "ok" : "error"}`);
}
