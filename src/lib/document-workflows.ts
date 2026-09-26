import { z } from "zod";

import { recordAuditEvent } from "@/lib/audit";
import type { DatabaseConnection } from "@/lib/db/client";
import { getDatabase } from "@/lib/db/client";
import {
  canonicalDocumentPlaceholders,
  getUserDocumentTemplate,
  type CanonicalDocumentPlaceholder,
  type DocumentTemplateSection,
} from "@/lib/document-templates";
import { isUserEnrolled } from "@/lib/enrollments";
import {
  copyDriveFile,
  ensureDriveFolderForUser,
  getDriveFileMetadata,
  trashDriveFile,
} from "@/lib/google/drive";
import { mergeGoogleDocument } from "@/lib/google/docs";
import type { GoogleFetch } from "@/lib/google/oauth";
import { getOfferingGoogleIntegration } from "@/lib/google/offering-integrations";
import { resolveDriveStorageUser } from "@/lib/google/storage-owner";
import { getStorageLayout } from "@/lib/storage-layout";

const GOOGLE_DOC_MIME = "application/vnd.google-apps.document";
const idSchema = z.number().int().positive();
const generationInputSchema = z.object({
  templateId: idSchema,
  offeringId: idSchema,
  activityId: idSchema.optional().nullable(),
  studentUserIds: z.array(idSchema).max(100).default([]),
  enabledOptionalSectionIds: z.array(idSchema).max(100).default([]),
  title: z.string().trim().min(1).max(180),
  topic: z.string().trim().max(300).optional().default(""),
  categoryKind: z.enum(["activity", "notes", "documents", "custom"]).optional(),
  date: z.iso.date(),
});

export type GenerateDocumentInput = z.input<typeof generationInputSchema>;
export type DocumentGenerationErrorCode =
  | "google-not-connected"
  | "docs-unavailable"
  | "template-invalid"
  | "template-access"
  | "drive-folder-missing"
  | "drive-access-pending"
  | "copy-failed"
  | "merge-failed";

export class DocumentGenerationError extends Error {
  constructor(public readonly code: DocumentGenerationErrorCode) {
    super(`Document generation failed: ${code}.`);
    this.name = "DocumentGenerationError";
  }
}
export type GeneratedDocumentRecord = {
  id: number;
  ownerUserId: number;
  storageUserId: number | null;
  templateId: number | null;
  templateName: string | null;
  offeringId: number;
  subjectName: string;
  activityId: number | null;
  activityTitle: string | null;
  driveFileId: string;
  webViewLink: string;
  name: string;
  googlePermissionStatus: "not_requested" | "granted" | "needs_authorization";
  googleModifiedAt: number | null;
  createdAt: number;
  updatedAt: number;
};

type ContextRow = {
  subjectName: string;
  subjectCode: string | null;
  programName: string;
  programShortName: string | null;
  programCode: string | null;
  periodLabel: string;
  instructorDisplayName: string | null;
  instructorName: string | null;
};

export function listOfferingParticipants(
  ownerUserId: number,
  offeringId: number,
  connection: DatabaseConnection = getDatabase(),
): Array<{ id: number; displayName: string }> {
  const ownerId = idSchema.parse(ownerUserId);
  const targetOfferingId = idSchema.parse(offeringId);
  if (!isUserEnrolled(ownerId, targetOfferingId, connection)) {
    throw new Error("Offering is outside the user's academic context.");
  }
  return connection.sqlite
    .prepare(
      `select u.id, u.display_name as displayName
       from enrollments e
       join users u on u.id = e.user_id and u.active = 1
       where e.offering_id = ?
       order by u.display_name collate nocase, u.id`,
    )
    .all(targetOfferingId) as Array<{ id: number; displayName: string }>;
}

function getContext(
  ownerUserId: number,
  offeringId: number,
  activityId: number | null,
  studentUserIds: number[],
  connection: DatabaseConnection,
) {
  if (!isUserEnrolled(ownerUserId, offeringId, connection)) {
    throw new Error("Offering is outside the user's academic context.");
  }
  const context = connection.sqlite
    .prepare(
      `select s.name as subjectName, s.code as subjectCode,
              p.name as programName, p.short_name as programShortName,
              p.code as programCode,
              ap.label as periodLabel, i.display_name as instructorDisplayName,
              i.name as instructorName
       from subject_offerings so
       join subjects s on s.id = so.subject_id
       join programs p on p.id = so.program_id
       join academic_periods ap on ap.id = so.academic_period_id
       left join instructors i on i.id = so.instructor_id
       where so.id = ?`,
    )
    .get(offeringId) as ContextRow | undefined;
  if (!context) throw new Error("Offering not found.");

  let activity: { title: string; description: string | null } | null = null;
  if (activityId !== null) {
    activity =
      (connection.sqlite
        .prepare(
          `select title, description from activities
           where id = ? and user_id = ? and offering_id = ?`,
        )
        .get(activityId, ownerUserId, offeringId) as
        { title: string; description: string | null } | undefined) ?? null;
    if (!activity) throw new Error("Activity not found.");
  }

  const participantIds = [
    ...new Set(studentUserIds.length ? studentUserIds : [ownerUserId]),
  ];
  const placeholders = participantIds.map(() => "?").join(",");
  const participants = connection.sqlite
    .prepare(
      `select u.id, u.display_name as displayName
       from users u
       join enrollments e on e.user_id = u.id and e.offering_id = ?
       where u.active = 1 and u.id in (${placeholders})
       order by u.display_name collate nocase, u.id`,
    )
    .all(offeringId, ...participantIds) as Array<{
    id: number;
    displayName: string;
  }>;
  if (participants.length !== participantIds.length) {
    throw new Error("Invalid document participants.");
  }
  return { context, activity, participants };
}

function renderSections(
  sections: DocumentTemplateSection[],
  enabledOptionalSectionIds: number[],
  values: Record<CanonicalDocumentPlaceholder, string>,
): string {
  const enabled = new Set(enabledOptionalSectionIds);
  return sections
    .filter((section) => !section.optional || enabled.has(section.id))
    .map((section) => {
      const initial = section.initialSource
        ? values[section.initialSource]
        : "";
      const body = initial || section.helperText || "";
      const marker = section.type === "code" ? "```\n" : "";
      const closing = section.type === "code" ? "\n```" : "";
      return `${section.displayTitle}\n${marker}${body}${closing}`.trimEnd();
    })
    .join("\n\n");
}

function renderPattern(
  pattern: string,
  values: Record<CanonicalDocumentPlaceholder, string>,
): string {
  const rendered = pattern.replaceAll(/\{\{([^{}]+)\}\}/gu, (_, key: string) =>
    canonicalDocumentPlaceholders.includes(key as CanonicalDocumentPlaceholder)
      ? values[key as CanonicalDocumentPlaceholder]
      : "",
  );
  const safe = rendered
    .replaceAll(/[\u0000-\u001f/\\]+/gu, " ")
    .replaceAll(/\s+/gu, " ")
    .trim()
    .slice(0, 255);
  if (!safe) throw new Error("Generated document name is empty.");
  return safe;
}

function generatedDocumentLink(fileId: string): string {
  return `https://docs.google.com/document/d/${encodeURIComponent(fileId)}/edit`;
}

function googleStageError(
  error: unknown,
  fallback: DocumentGenerationErrorCode,
): DocumentGenerationError {
  if (
    error instanceof Error &&
    error.message === "Google access is unavailable."
  ) {
    return new DocumentGenerationError("google-not-connected");
  }
  return new DocumentGenerationError(fallback);
}

export async function validateDocumentTemplateSource(
  ownerUserId: number,
  sourceFileId: string,
  options: {
    connection?: DatabaseConnection;
    fetchImpl?: GoogleFetch;
  } = {},
): Promise<void> {
  try {
    const source = await getDriveFileMetadata(
      ownerUserId,
      sourceFileId,
      options,
    );
    if (source.trashed || source.mimeType !== GOOGLE_DOC_MIME) {
      throw new DocumentGenerationError("template-invalid");
    }
  } catch (error) {
    if (error instanceof DocumentGenerationError) throw error;
    throw googleStageError(error, "template-access");
  }
}

export function listUserGeneratedDocuments(
  ownerUserId: number,
  connection: DatabaseConnection = getDatabase(),
): GeneratedDocumentRecord[] {
  return connection.sqlite
    .prepare(
      `select gd.id, gd.owner_user_id as ownerUserId,
              gd.storage_user_id as storageUserId,
              gd.template_id as templateId, dt.name as templateName,
              gd.offering_id as offeringId, s.name as subjectName,
              gd.activity_id as activityId, a.title as activityTitle,
              gd.drive_file_id as driveFileId, gd.web_view_link as webViewLink,
              gd.name, gd.google_permission_status as googlePermissionStatus,
              gd.google_modified_at as googleModifiedAt,
              gd.created_at as createdAt, gd.updated_at as updatedAt
       from generated_documents gd
       join subject_offerings so on so.id = gd.offering_id
       join subjects s on s.id = so.subject_id
       left join document_templates dt on dt.id = gd.template_id
       left join activities a on a.id = gd.activity_id
       where gd.owner_user_id = ?
       order by gd.created_at desc, gd.id desc`,
    )
    .all(idSchema.parse(ownerUserId)) as GeneratedDocumentRecord[];
}

export async function deleteGeneratedDocument(
  ownerUserId: number,
  documentId: number,
  mode: "hub" | "drive",
  options: {
    connection?: DatabaseConnection;
    fetchImpl?: GoogleFetch;
  } = {},
): Promise<void> {
  const ownerId = idSchema.parse(ownerUserId);
  const targetId = idSchema.parse(documentId);
  const connection = options.connection ?? getDatabase();
  const fetchImpl = options.fetchImpl ?? fetch;
  const row = connection.sqlite
    .prepare(
      `select id, owner_user_id as ownerUserId, storage_user_id as storageUserId,
              drive_file_id as driveFileId
       from generated_documents where id = ? and owner_user_id = ?`,
    )
    .get(targetId, ownerId) as
    | {
        id: number;
        ownerUserId: number;
        storageUserId: number | null;
        driveFileId: string;
      }
    | undefined;
  if (!row) throw new Error("Generated document not found.");

  if (mode === "drive") {
    const storageUserId = row.storageUserId ?? ownerId;
    await trashDriveFile(storageUserId, row.driveFileId, {
      connection,
      fetchImpl,
    });
  }

  const result = connection.sqlite
    .prepare(
      "delete from generated_documents where id = ? and owner_user_id = ?",
    )
    .run(targetId, ownerId);
  if (result.changes !== 1) throw new Error("Generated document not found.");
  recordAuditEvent(
    {
      actorUserId: ownerId,
      action:
        mode === "drive" ? "document.delete_drive" : "document.remove_hub",
      targetType: "generated_document",
      targetId: String(targetId),
      summary:
        mode === "drive"
          ? "generated document removed from Hub and moved to Drive trash"
          : "generated document removed from Hub only",
    },
    connection,
  );
}

export function listSharedGeneratedDocuments(
  userId: number,
  connection: DatabaseConnection = getDatabase(),
): Array<GeneratedDocumentRecord & { googlePermissionStatus: string }> {
  return connection.sqlite
    .prepare(
      `select distinct d.id, d.owner_user_id as ownerUserId,
              d.storage_user_id as storageUserId,
              d.template_id as templateId, dt.name as templateName,
              d.offering_id as offeringId, s.name as subjectName,
              d.activity_id as activityId, a.title as activityTitle,
              d.drive_file_id as driveFileId, d.web_view_link as webViewLink,
              d.name, d.google_modified_at as googleModifiedAt,
              d.created_at as createdAt, d.updated_at as updatedAt,
              coalesce(
                (select dps.google_permission_status from document_person_shares dps
                 where dps.document_id=d.id and dps.recipient_user_id=?),
                (select dgs.google_permission_status from document_group_shares dgs
                 join study_group_members gm on gm.group_id=dgs.group_id
                 where dgs.document_id=d.id and gm.user_id=? limit 1),
                'needs_authorization'
              ) as googlePermissionStatus
       from generated_documents d
       left join document_templates dt on dt.id = d.template_id
       join subject_offerings so on so.id = d.offering_id
       join subjects s on s.id = so.subject_id
       left join activities a on a.id = d.activity_id
       where d.owner_user_id != ? and (
         exists(select 1 from document_person_shares dps where dps.document_id=d.id and dps.recipient_user_id=?)
         or exists(select 1 from document_group_shares dgs
           join study_group_members gm on gm.group_id=dgs.group_id
           where dgs.document_id=d.id and gm.user_id=?)
       )
       order by d.updated_at desc, d.id desc`,
    )
    .all(idSchema.parse(userId), userId, userId, userId, userId) as Array<
    GeneratedDocumentRecord & { googlePermissionStatus: string }
  >;
}

async function ensureDocumentDestinationFolder(
  storageUserId: number,
  offeringId: number,
  offeringFolderId: string,
  categoryKind: "activity" | "notes" | "documents" | "custom",
  connection: DatabaseConnection,
  fetchImpl: GoogleFetch,
): Promise<string> {
  const layout = getStorageLayout(connection);
  const targetKind = categoryKind === "custom" ? "documents" : categoryKind;
  const category =
    layout.categories.find(
      ({ kind, enabled }) => kind === targetKind && enabled,
    ) ??
    layout.categories.find(
      ({ kind, enabled }) => kind === "documents" && enabled,
    );
  if (!category) return offeringFolderId;
  const folder = await ensureDriveFolderForUser(
    storageUserId,
    {
      name: category.label,
      parentId: offeringFolderId,
      identityKey: `offering:${offeringId}:category:${category.key}`,
    },
    { connection, fetchImpl },
  );
  return folder.id;
}

export async function generateDocument(
  ownerUserId: number,
  input: GenerateDocumentInput,
  options: {
    connection?: DatabaseConnection;
    fetchImpl?: GoogleFetch;
  } = {},
): Promise<GeneratedDocumentRecord> {
  const ownerId = idSchema.parse(ownerUserId);
  const value = generationInputSchema.parse(input);
  const connection = options.connection ?? getDatabase();
  const fetchImpl = options.fetchImpl ?? fetch;
  const template = getUserDocumentTemplate(
    ownerId,
    value.templateId,
    connection,
  );
  if (!template.active) throw new Error("Document template is inactive.");
  const integration = getOfferingGoogleIntegration(
    value.offeringId,
    connection,
  );
  if (!integration?.driveFolderId) {
    throw new DocumentGenerationError("drive-folder-missing");
  }
  const templateStorageUserId = resolveDriveStorageUser(
    ownerId,
    template.storageUserId,
    { connection, useConfiguredForNew: false },
  );
  const destinationStorageUserId = resolveDriveStorageUser(
    ownerId,
    integration.driveStorageUserId,
    { connection, useConfiguredForNew: false },
  );
  if (
    process.env.OPENSTUDYHUB_V2_ENABLED === "1" &&
    destinationStorageUserId !== ownerId
  )
    throw new DocumentGenerationError("drive-access-pending");
  if (templateStorageUserId !== destinationStorageUserId) {
    throw new DocumentGenerationError("template-access");
  }
  const storageUserId = destinationStorageUserId;
  const { context, activity, participants } = getContext(
    ownerId,
    value.offeringId,
    value.activityId ?? null,
    value.studentUserIds,
    connection,
  );
  const values = {
    "subject.name": context.subjectName,
    "subject.code": context.subjectCode ?? "",
    "program.name": context.programName,
    "program.short_name":
      context.programShortName?.trim() || context.programCode || "",
    "period.label": context.periodLabel,
    "students.names": participants
      .map(({ displayName }) => displayName)
      .join(", "),
    "document.date": value.date,
    "document.topic": value.topic,
    "document.title": value.title,
    "document.sections": "",
    "activity.title": activity?.title ?? "",
    "activity.prompt": activity?.description ?? "",
    "instructor.display_name":
      context.instructorDisplayName ?? context.instructorName ?? "",
  } satisfies Record<CanonicalDocumentPlaceholder, string>;
  values["document.sections"] = renderSections(
    template.sections,
    value.enabledOptionalSectionIds,
    values,
  );
  for (const required of template.requiredPlaceholders) {
    if (!values[required].trim()) {
      throw new Error("Required document context is missing.");
    }
  }
  const name = renderPattern(template.namingPattern, values);
  const isBundledStarter = Boolean(
    connection.sqlite
      .prepare(
        `SELECT 1 FROM app_settings WHERE key LIKE ? AND value = ? LIMIT 1`,
      )
      .get(`starter_template.imported.${ownerId}.%`, String(template.id)),
  );

  await validateDocumentTemplateSource(storageUserId, template.sourceFileId, {
    connection,
    fetchImpl,
  });
  let copied: Awaited<ReturnType<typeof copyDriveFile>>;
  try {
    const destinationFolderId = await ensureDocumentDestinationFolder(
      storageUserId,
      value.offeringId,
      integration.driveFolderId,
      value.categoryKind ?? template.categoryKind,
      connection,
      fetchImpl,
    );
    copied = await copyDriveFile(
      storageUserId,
      {
        sourceFileId: template.sourceFileId,
        name,
        parentFolderId: destinationFolderId,
      },
      { connection, fetchImpl },
    );
  } catch (error) {
    throw googleStageError(error, "copy-failed");
  }
  try {
    try {
      await mergeGoogleDocument(
        storageUserId,
        copied.id,
        canonicalDocumentPlaceholders.map((placeholder) => ({
          placeholder,
          value: values[placeholder],
        })),
        isBundledStarter ? "" : values["document.sections"],
        { connection, fetchImpl },
      );
    } catch (error) {
      if (
        error instanceof Error &&
        error.message === "Google access is unavailable."
      ) {
        throw new DocumentGenerationError("google-not-connected");
      }
      if (error instanceof Error && error.message.includes("Google Docs")) {
        throw new DocumentGenerationError("docs-unavailable");
      }
      throw new DocumentGenerationError("merge-failed");
    }
    const now = Date.now();
    const modified = copied.modifiedTime
      ? Date.parse(copied.modifiedTime)
      : Number.NaN;
    const result = connection.sqlite
      .prepare(
        `insert into generated_documents
         (owner_user_id, storage_user_id, template_id, offering_id, activity_id,
          drive_file_id, web_view_link, name, google_permission_status,
          google_modified_at, created_at, updated_at)
         values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        ownerId,
        storageUserId,
        template.id,
        value.offeringId,
        value.activityId ?? null,
        copied.id,
        copied.webViewLink ?? generatedDocumentLink(copied.id),
        name,
        storageUserId === ownerId ? "not_requested" : "needs_authorization",
        Number.isNaN(modified) ? null : modified,
        now,
        now,
      );
    const localId = Number(result.lastInsertRowid);
    recordAuditEvent(
      {
        actorUserId: ownerId,
        action: "document.generate",
        targetType: "generated_document",
        targetId: String(localId),
        summary: "Google document generated from template",
      },
      connection,
    );
    return listUserGeneratedDocuments(ownerId, connection).find(
      ({ id }) => id === localId,
    )!;
  } catch (error) {
    try {
      await trashDriveFile(storageUserId, copied.id, {
        connection,
        fetchImpl,
      });
    } catch {
      // Best-effort cleanup of the copy created by this failed operation.
    }
    throw error;
  }
}
