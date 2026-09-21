import { z } from "zod";

import { assertCanManageOffering } from "@/lib/academic-authority";
import { recordAuditEvent } from "@/lib/audit";
import type { DatabaseConnection } from "@/lib/db/client";
import { getDatabase } from "@/lib/db/client";

const idSchema = z.number().int().positive();
const GOOGLE_NOTEBOOK_HOSTS = new Set([
  "notebook.google.com",
  "notebooklm.google.com",
  "gemini.google.com",
]);
const optionalText = z
  .string()
  .trim()
  .max(255)
  .optional()
  .nullable()
  .transform((value) => value || null);

export const notebookUrlSchema = z
  .string()
  .trim()
  .max(2048)
  .optional()
  .nullable()
  .transform((value) => value || null)
  .refine((value) => {
    if (!value) return true;
    try {
      const url = new URL(value);
      return (
        url.protocol === "https:" &&
        !url.username &&
        !url.password &&
        GOOGLE_NOTEBOOK_HOSTS.has(url.hostname)
      );
    } catch {
      return false;
    }
  }, "Invalid Google Notebook URL.");

const integrationInputSchema = z.object({
  notebookUrl: notebookUrlSchema,
  classroomCourseId: optionalText,
  classroomCourseName: optionalText,
});

export type OfferingGoogleIntegration = {
  offeringId: number;
  driveFolderId: string | null;
  driveFolderName: string | null;
  driveStorageUserId: number | null;
  notebookUrl: string | null;
  classroomCourseId: string | null;
  classroomCourseName: string | null;
  updatedAt: number;
};

export function getOfferingGoogleIntegration(
  offeringId: number,
  connection: DatabaseConnection = getDatabase(),
): OfferingGoogleIntegration | null {
  return (
    (connection.sqlite
      .prepare(
        `select offering_id as offeringId, drive_folder_id as driveFolderId,
                drive_folder_name as driveFolderName,
                drive_storage_user_id as driveStorageUserId,
                notebook_url as notebookUrl,
                classroom_course_id as classroomCourseId,
                classroom_course_name as classroomCourseName,
                updated_at as updatedAt
         from offering_google_integrations where offering_id = ?`,
      )
      .get(idSchema.parse(offeringId)) as
      OfferingGoogleIntegration | undefined) ?? null
  );
}

export function listOfferingGoogleIntegrations(
  offeringIds: number[],
  connection: DatabaseConnection = getDatabase(),
): OfferingGoogleIntegration[] {
  const ids = [...new Set(z.array(idSchema).max(500).parse(offeringIds))];
  if (ids.length === 0) return [];
  return connection.sqlite
    .prepare(
      `select offering_id as offeringId, drive_folder_id as driveFolderId,
              drive_folder_name as driveFolderName,
              drive_storage_user_id as driveStorageUserId,
              notebook_url as notebookUrl,
              classroom_course_id as classroomCourseId,
              classroom_course_name as classroomCourseName,
              updated_at as updatedAt
       from offering_google_integrations
       where offering_id in (${ids.map(() => "?").join(",")})
       order by offering_id`,
    )
    .all(...ids) as OfferingGoogleIntegration[];
}

export function updateOfferingGoogleIntegration(
  actorUserId: number,
  offeringId: number,
  input: z.input<typeof integrationInputSchema>,
  connection: DatabaseConnection = getDatabase(),
): void {
  const actorId = idSchema.parse(actorUserId);
  const targetId = idSchema.parse(offeringId);
  const value = integrationInputSchema.parse(input);
  assertCanManageOffering(actorId, targetId, connection);
  const previous = getOfferingGoogleIntegration(targetId, connection);
  const notebookChanged = (previous?.notebookUrl ?? null) !== value.notebookUrl;
  const classroomChanged =
    (previous?.classroomCourseId ?? null) !== value.classroomCourseId ||
    (previous?.classroomCourseName ?? null) !== value.classroomCourseName;
  const now = Date.now();
  connection.sqlite.transaction(() => {
    connection.sqlite
      .prepare(
        `insert into offering_google_integrations
         (offering_id, notebook_url, classroom_course_id,
          classroom_course_name, updated_by_user_id, updated_at)
         values (?, ?, ?, ?, ?, ?)
         on conflict(offering_id) do update set
           notebook_url = excluded.notebook_url,
           classroom_course_id = excluded.classroom_course_id,
           classroom_course_name = excluded.classroom_course_name,
           updated_by_user_id = excluded.updated_by_user_id,
           updated_at = excluded.updated_at`,
      )
      .run(
        targetId,
        value.notebookUrl,
        value.classroomCourseId,
        value.classroomCourseName,
        actorId,
        now,
      );
    if (notebookChanged) {
      recordAuditEvent(
        {
          actorUserId: actorId,
          action: "google.notebook_link_update",
          targetType: "subject_offering",
          targetId: String(targetId),
          summary: "Google Notebook link updated",
        },
        connection,
      );
    }
    if (classroomChanged) {
      recordAuditEvent(
        {
          actorUserId: actorId,
          action: "google.classroom_mapping_update",
          targetType: "subject_offering",
          targetId: String(targetId),
          summary: "Classroom course mapping updated",
        },
        connection,
      );
    }
  })();
}

export function setOfferingDriveFolder(
  actorUserId: number,
  offeringId: number,
  folderId: string,
  folderName: string,
  storageUserId: number,
  connection: DatabaseConnection = getDatabase(),
): void {
  const actorId = idSchema.parse(actorUserId);
  const targetId = idSchema.parse(offeringId);
  assertCanManageOffering(actorId, targetId, connection);
  const safeFolderId = z.string().trim().min(1).max(255).parse(folderId);
  const safeFolderName = z.string().trim().min(1).max(255).parse(folderName);
  const safeStorageUserId = idSchema.parse(storageUserId);
  const now = Date.now();
  connection.sqlite.transaction(() => {
    connection.sqlite
      .prepare(
        `insert into offering_google_integrations
         (offering_id, drive_folder_id, drive_folder_name,
          drive_storage_user_id, updated_by_user_id, updated_at)
         values (?, ?, ?, ?, ?, ?)
         on conflict(offering_id) do update set
           drive_folder_id = excluded.drive_folder_id,
           drive_folder_name = excluded.drive_folder_name,
           drive_storage_user_id = excluded.drive_storage_user_id,
           updated_by_user_id = excluded.updated_by_user_id,
           updated_at = excluded.updated_at`,
      )
      .run(
        targetId,
        safeFolderId,
        safeFolderName,
        safeStorageUserId,
        actorId,
        now,
      );
    recordAuditEvent(
      {
        actorUserId: actorId,
        action: "google.drive_folder_map",
        targetType: "subject_offering",
        targetId: String(targetId),
        summary: "Drive folder mapped to offering",
      },
      connection,
    );
  })();
}
