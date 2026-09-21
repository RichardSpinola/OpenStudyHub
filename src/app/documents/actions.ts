"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { recordAuditEvent } from "@/lib/audit";
import { requireAuthenticatedUser } from "@/lib/authorization";
import {
  addDocumentTemplateSection,
  canonicalDocumentPlaceholders,
  cloneDocumentTemplate,
  createDocumentTemplate,
  deleteDocumentTemplate,
  deleteDocumentTemplateSection,
  getUserDocumentTemplate,
  moveDocumentTemplateSection,
  parseGoogleDocumentId,
  updateDocumentTemplate,
  updateDocumentTemplateSection,
  documentCategorySchema,
} from "@/lib/document-templates";
import {
  DocumentGenerationError,
  deleteGeneratedDocument,
  generateDocument,
  validateDocumentTemplateSource,
} from "@/lib/document-workflows";
import { createGoogleTemplateDocument } from "@/lib/google/docs";
import { importStarterDocumentTemplate } from "@/lib/starter-document-templates";
import {
  docxTemplateLimitBytes,
  importDocxTemplate,
} from "@/lib/docx-template-import";
import { setDocumentGroupShare } from "@/lib/collaboration";
import { resolveDriveStorageUser } from "@/lib/google/storage-owner";

const idSchema = z.coerce.number().int().positive();
const directionSchema = z.enum(["up", "down"]);
const sectionTypeSchema = z.enum(["text", "code", "text_or_image"]);
const placeholderSchema = z.enum(canonicalDocumentPlaceholders);

function text(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function checked(formData: FormData, key: string): boolean {
  return formData.get(key) === "on";
}

function ids(formData: FormData, key: string): number[] {
  return formData.getAll(key).map((value) => idSchema.parse(value));
}

function templateInput(formData: FormData, sourceFileId: string) {
  return {
    name: text(formData, "name"),
    description: text(formData, "description"),
    categoryKind: documentCategorySchema.parse(
      text(formData, "categoryKind") || "documents",
    ),
    sourceFileId,
    namingPattern: text(formData, "namingPattern"),
    requiredPlaceholders: formData
      .getAll("requiredPlaceholders")
      .map((value) => placeholderSchema.parse(value)),
    active: checked(formData, "active"),
  };
}

function sectionInput(formData: FormData) {
  const initial = text(formData, "initialSource");
  const displayTitle = text(formData, "displayTitle");
  const requestedKey = text(formData, "internalKey");
  const generatedKey = displayTitle
    .normalize("NFD")
    .replaceAll(/[\u0300-\u036f]/gu, "")
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/gu, "_")
    .replaceAll(/^_+|_+$/gu, "")
    .slice(0, 40);
  return {
    internalKey: requestedKey || generatedKey || "section",
    displayTitle,
    type: sectionTypeSchema.parse(formData.get("type")),
    optional: checked(formData, "optional"),
    initialSource: initial ? placeholderSchema.parse(initial) : null,
    helperText: text(formData, "helperText"),
  };
}

function refresh(templateId?: number) {
  revalidatePath("/documents");
  revalidatePath("/subjects");
  revalidatePath("/activities");
  if (templateId) revalidatePath(`/documents/templates/${templateId}`);
}

function templateErrorStatus(error: unknown): string {
  if (!(error instanceof DocumentGenerationError)) return "template-error";
  if (
    ["google-not-connected", "template-invalid", "template-access"].includes(
      error.code,
    )
  ) {
    return `template-${error.code}`;
  }
  return "template-error";
}

export async function createDocumentTemplateAction(formData: FormData) {
  const user = await requireAuthenticatedUser();
  let templateId: number;
  try {
    const storageUserId = resolveDriveStorageUser(user.id, null);
    const sourceInput = text(formData, "sourceFile");
    const sourceFileId = sourceInput
      ? parseGoogleDocumentId(sourceInput)
      : (
          await createGoogleTemplateDocument(
            storageUserId,
            `${text(formData, "name")} — OpenStudyHub template`,
          )
        ).documentId;
    if (sourceInput) {
      await validateDocumentTemplateSource(storageUserId, sourceFileId);
    }
    const template = createDocumentTemplate(
      user.id,
      templateInput(formData, sourceFileId),
      undefined,
      storageUserId,
    );
    templateId = template.id;
    recordAuditEvent({
      actorUserId: user.id,
      action: "document_template.create",
      targetType: "document_template",
      targetId: String(template.id),
      summary: "private document template created",
    });
    refresh(template.id);
  } catch (error) {
    redirect(`/documents?view=templates&status=${templateErrorStatus(error)}`);
  }
  redirect(`/documents/templates/${templateId}`);
}

export async function updateDocumentTemplateAction(formData: FormData) {
  const user = await requireAuthenticatedUser();
  const templateId = idSchema.parse(formData.get("templateId"));
  try {
    const existing = getUserDocumentTemplate(user.id, templateId);
    const storageUserId = resolveDriveStorageUser(
      user.id,
      existing.storageUserId,
      { useConfiguredForNew: false },
    );
    const sourceFileId = parseGoogleDocumentId(text(formData, "sourceFile"));
    await validateDocumentTemplateSource(storageUserId, sourceFileId);
    updateDocumentTemplate(
      user.id,
      templateId,
      templateInput(formData, sourceFileId),
      undefined,
      storageUserId,
    );
    recordAuditEvent({
      actorUserId: user.id,
      action: "document_template.update",
      targetType: "document_template",
      targetId: String(templateId),
      summary: "private document template updated",
    });
    refresh(templateId);
  } catch (error) {
    redirect(
      `/documents/templates/${templateId}?status=${templateErrorStatus(error)}`,
    );
  }
  redirect(`/documents/templates/${templateId}?status=ok`);
}

export async function cloneDocumentTemplateAction(formData: FormData) {
  const user = await requireAuthenticatedUser();
  const sourceId = idSchema.parse(formData.get("templateId"));
  let cloneId: number;
  try {
    const clone = cloneDocumentTemplate(
      user.id,
      sourceId,
      text(formData, "cloneName"),
    );
    cloneId = clone.id;
    recordAuditEvent({
      actorUserId: user.id,
      action: "document_template.clone",
      targetType: "document_template",
      targetId: String(clone.id),
      summary: "private document template cloned",
    });
    refresh(clone.id);
  } catch {
    redirect(`/documents/templates/${sourceId}?status=error`);
  }
  redirect(`/documents/templates/${cloneId}`);
}

export async function deleteDocumentTemplateAction(formData: FormData) {
  const user = await requireAuthenticatedUser();
  const templateId = idSchema.parse(formData.get("templateId"));
  try {
    deleteDocumentTemplate(user.id, templateId);
    recordAuditEvent({
      actorUserId: user.id,
      action: "document_template.delete",
      targetType: "document_template",
      targetId: String(templateId),
      summary: "private document template deleted",
    });
    refresh(templateId);
  } catch {
    redirect(`/documents/templates/${templateId}?status=error`);
  }
  redirect("/documents?view=templates&status=template-deleted");
}

export async function addDocumentTemplateSectionAction(formData: FormData) {
  const user = await requireAuthenticatedUser();
  const templateId = idSchema.parse(formData.get("templateId"));
  try {
    addDocumentTemplateSection(user.id, templateId, sectionInput(formData));
    refresh(templateId);
  } catch {
    redirect(`/documents/templates/${templateId}?status=error`);
  }
  redirect(`/documents/templates/${templateId}?status=ok`);
}

export async function updateDocumentTemplateSectionAction(formData: FormData) {
  const user = await requireAuthenticatedUser();
  const templateId = idSchema.parse(formData.get("templateId"));
  try {
    updateDocumentTemplateSection(
      user.id,
      templateId,
      idSchema.parse(formData.get("sectionId")),
      sectionInput(formData),
    );
    refresh(templateId);
  } catch {
    redirect(`/documents/templates/${templateId}?status=error`);
  }
  redirect(`/documents/templates/${templateId}?status=ok`);
}

export async function moveDocumentTemplateSectionAction(formData: FormData) {
  const user = await requireAuthenticatedUser();
  const templateId = idSchema.parse(formData.get("templateId"));
  try {
    moveDocumentTemplateSection(
      user.id,
      templateId,
      idSchema.parse(formData.get("sectionId")),
      directionSchema.parse(formData.get("direction")),
    );
    refresh(templateId);
  } catch {
    redirect(`/documents/templates/${templateId}?status=error`);
  }
  redirect(`/documents/templates/${templateId}?status=ok`);
}

export async function deleteDocumentTemplateSectionAction(formData: FormData) {
  const user = await requireAuthenticatedUser();
  const templateId = idSchema.parse(formData.get("templateId"));
  try {
    deleteDocumentTemplateSection(
      user.id,
      templateId,
      idSchema.parse(formData.get("sectionId")),
    );
    refresh(templateId);
  } catch {
    redirect(`/documents/templates/${templateId}?status=error`);
  }
  redirect(`/documents/templates/${templateId}?status=ok`);
}

export async function generateDocumentAction(formData: FormData) {
  const user = await requireAuthenticatedUser();
  const offeringId = idSchema.parse(formData.get("offeringId"));
  const activityRaw = text(formData, "activityId");
  let documentId: number;
  let shareWarning = false;
  try {
    const generated = await generateDocument(user.id, {
      templateId: idSchema.parse(formData.get("templateId")),
      offeringId,
      activityId: activityRaw ? idSchema.parse(activityRaw) : null,
      studentUserIds: ids(formData, "studentUserIds"),
      enabledOptionalSectionIds: ids(formData, "optionalSectionIds"),
      title: text(formData, "title"),
      topic: text(formData, "topic"),
      categoryKind: (text(formData, "categoryKind") || undefined) as
        "activity" | "notes" | "documents" | "custom" | undefined,
      date: text(formData, "date"),
    });
    const shareGroup = text(formData, "shareGroupId");
    if (shareGroup) {
      try {
        setDocumentGroupShare(
          user.id,
          generated.id,
          idSchema.parse(shareGroup),
          true,
        );
      } catch {
        shareWarning = true;
      }
    }
    documentId = generated.id;
    refresh();
  } catch (error) {
    const status =
      error instanceof DocumentGenerationError
        ? `generation-${error.code}`
        : "generation-error";
    redirect(
      `/documents?view=generate&offeringId=${offeringId}&status=${status}`,
    );
  }
  redirect(
    `/documents?view=generate&offeringId=${offeringId}&status=${shareWarning ? "generated-share-warning" : "generated"}&documentId=${documentId}`,
  );
}

export async function importStarterDocumentTemplateAction(formData: FormData) {
  const user = await requireAuthenticatedUser();
  let templateId: number;
  try {
    templateId = await importStarterDocumentTemplate(
      user.id,
      text(formData, "starterKey"),
    );
    recordAuditEvent({
      actorUserId: user.id,
      action: "document_template.import_starter",
      targetType: "document_template",
      targetId: String(templateId),
      summary: "public starter document template imported",
    });
    refresh(templateId);
  } catch {
    redirect("/documents?view=templates&status=template-error");
  }
  redirect(`/documents/templates/${templateId}`);
}

export async function importDocxTemplateAction(formData: FormData) {
  const user = await requireAuthenticatedUser();
  try {
    const file = formData.get("docx");
    if (
      !(file instanceof File) ||
      file.size <= 0 ||
      file.size > docxTemplateLimitBytes
    ) {
      throw new Error("Invalid DOCX upload.");
    }
    const template = await importDocxTemplate(user.id, {
      name: text(formData, "name"),
      description: text(formData, "description"),
      categoryKind: documentCategorySchema.parse(
        text(formData, "categoryKind") || "documents",
      ),
      filename: file.name,
      data: Buffer.from(await file.arrayBuffer()),
      namingPattern: text(formData, "namingPattern") || undefined,
    });
    recordAuditEvent({
      actorUserId: user.id,
      action: "document_template.import_docx",
      targetType: "document_template",
      targetId: String(template.id),
      summary: "private DOCX template imported as Google Document",
    });
    refresh(template.id);
    redirect(`/documents/templates/${template.id}`);
  } catch (error) {
    if (error && typeof error === "object" && "digest" in error) throw error;
    redirect("/documents?view=templates&status=template-invalid");
  }
}

export async function setDocumentGroupShareAction(formData: FormData) {
  const user = await requireAuthenticatedUser();
  const documentId = idSchema.parse(formData.get("documentId"));
  try {
    setDocumentGroupShare(
      user.id,
      documentId,
      idSchema.parse(formData.get("groupId")),
      formData.get("shared") === "true",
    );
    refresh();
  } catch {
    redirect("/documents?view=library&status=share-error");
  }
  redirect("/documents?view=library&status=share-ok");
}

export async function deleteGeneratedDocumentAction(formData: FormData) {
  const user = await requireAuthenticatedUser();
  const documentId = idSchema.parse(formData.get("documentId"));
  const mode = z.enum(["hub", "drive"]).parse(formData.get("mode"));
  try {
    await deleteGeneratedDocument(user.id, documentId, mode);
    revalidatePath("/documents");
  } catch {
    redirect("/documents?view=library&status=document-delete-error");
  }
  redirect(
    `/documents?view=library&status=${mode === "drive" ? "document-deleted-drive" : "document-removed-hub"}`,
  );
}
