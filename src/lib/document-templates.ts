import { z } from "zod";

import type { DatabaseConnection } from "@/lib/db/client";
import { getDatabase } from "@/lib/db/client";

const idSchema = z.number().int().positive();
const sourceFileIdSchema = z.string().regex(/^[A-Za-z0-9_-]{10,255}$/u);
export const canonicalDocumentPlaceholders = [
  "subject.name",
  "subject.code",
  "program.name",
  "program.short_name",
  "period.label",
  "students.names",
  "document.date",
  "document.topic",
  "document.title",
  "document.sections",
  "activity.title",
  "activity.prompt",
  "instructor.display_name",
] as const;
export type CanonicalDocumentPlaceholder =
  (typeof canonicalDocumentPlaceholders)[number];
const placeholderSchema = z.enum(canonicalDocumentPlaceholders);
const sectionTypeSchema = z.enum(["text", "code", "text_or_image"]);
export const documentCategorySchema = z.enum([
  "activity",
  "notes",
  "documents",
  "custom",
]);
export type DocumentCategoryKind = z.infer<typeof documentCategorySchema>;
const internalKeySchema = z
  .string()
  .trim()
  .min(1)
  .max(40)
  .regex(/^[a-z][a-z0-9_]*$/u);
const namingPatternSchema = z
  .string()
  .trim()
  .min(1)
  .max(240)
  .superRefine((value, context) => {
    for (const match of value.matchAll(/\{\{([^{}]+)\}\}/gu)) {
      if (!placeholderSchema.safeParse(match[1]).success) {
        context.addIssue({
          code: "custom",
          message: "Unknown document placeholder.",
        });
      }
    }
  });
const templateInputSchema = z.object({
  name: z.string().trim().min(1).max(160),
  categoryKind: documentCategorySchema.default("documents"),
  description: z
    .string()
    .trim()
    .max(1000)
    .optional()
    .nullable()
    .transform((value) => value || null),
  sourceFileId: sourceFileIdSchema,
  namingPattern: namingPatternSchema,
  requiredPlaceholders: z.array(placeholderSchema).max(30).default([]),
  active: z.boolean().default(true),
});
const sectionInputSchema = z.object({
  internalKey: internalKeySchema,
  displayTitle: z.string().trim().min(1).max(120),
  type: sectionTypeSchema,
  optional: z.boolean().default(false),
  initialSource: placeholderSchema.optional().nullable(),
  helperText: z
    .string()
    .trim()
    .max(500)
    .optional()
    .nullable()
    .transform((value) => value || null),
});

export type DocumentTemplateInput = z.input<typeof templateInputSchema>;
export type DocumentTemplateSectionInput = z.input<typeof sectionInputSchema>;
export type DocumentTemplateSection = {
  id: number;
  templateId: number;
  internalKey: string;
  displayTitle: string;
  type: z.infer<typeof sectionTypeSchema>;
  sortOrder: number;
  optional: boolean;
  initialSource: CanonicalDocumentPlaceholder | null;
  helperText: string | null;
};
export type DocumentTemplateRecord = {
  id: number;
  ownerUserId: number;
  storageUserId: number | null;
  baseTemplateId: number | null;
  name: string;
  description: string | null;
  categoryKind: DocumentCategoryKind;
  sourceFileId: string;
  namingPattern: string;
  destinationStrategy: "offering_drive_folder";
  requiredPlaceholders: CanonicalDocumentPlaceholder[];
  active: boolean;
  createdAt: number;
  updatedAt: number;
  sections: DocumentTemplateSection[];
};

type StoredTemplate = Omit<
  DocumentTemplateRecord,
  "requiredPlaceholders" | "active" | "sections"
> & { requiredPlaceholders: string; active: number };

export function parseGoogleDocumentId(input: string): string {
  const value = z.string().trim().min(1).max(2048).parse(input);
  if (sourceFileIdSchema.safeParse(value).success) return value;
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error("Invalid Google document reference.");
  }
  if (url.protocol !== "https:" || url.hostname !== "docs.google.com") {
    throw new Error("Invalid Google document reference.");
  }
  const match = url.pathname.match(
    /^\/document\/d\/([A-Za-z0-9_-]{10,255})(?:\/|$)/u,
  );
  if (!match || !sourceFileIdSchema.safeParse(match[1]).success) {
    throw new Error("Invalid Google document reference.");
  }
  return match[1];
}

function parseRequiredPlaceholders(value: string) {
  try {
    return z.array(placeholderSchema).max(30).parse(JSON.parse(value));
  } catch {
    throw new Error("Invalid template placeholder configuration.");
  }
}

function listSections(templateId: number, connection: DatabaseConnection) {
  const rows = connection.sqlite
    .prepare(
      `select id, template_id as templateId, internal_key as internalKey,
              display_title as displayTitle, type, sort_order as sortOrder,
              optional, initial_source as initialSource,
              helper_text as helperText
       from document_template_sections where template_id = ?
       order by sort_order, id`,
    )
    .all(templateId) as Array<
    Omit<DocumentTemplateSection, "optional"> & { optional: number }
  >;
  return rows.map((row) => ({ ...row, optional: row.optional === 1 }));
}

function mapTemplate(
  row: StoredTemplate,
  connection: DatabaseConnection,
): DocumentTemplateRecord {
  return {
    ...row,
    active: row.active === 1,
    requiredPlaceholders: parseRequiredPlaceholders(row.requiredPlaceholders),
    sections: listSections(row.id, connection),
  };
}

const templateSelect = `
  select id, owner_user_id as ownerUserId,
         storage_user_id as storageUserId,
         base_template_id as baseTemplateId, name, description,
         category_kind as categoryKind, source_file_id as sourceFileId,
         naming_pattern as namingPattern,
         destination_strategy as destinationStrategy,
         required_placeholders as requiredPlaceholders, active,
         created_at as createdAt, updated_at as updatedAt
  from document_templates
`;

export function listUserDocumentTemplates(
  ownerUserId: number,
  options: { activeOnly?: boolean } = {},
  connection: DatabaseConnection = getDatabase(),
): DocumentTemplateRecord[] {
  const rows = connection.sqlite
    .prepare(
      `${templateSelect}
       where owner_user_id = ?${options.activeOnly ? " and active = 1" : ""}
       order by name collate nocase, id`,
    )
    .all(idSchema.parse(ownerUserId)) as StoredTemplate[];
  return rows.map((row) => mapTemplate(row, connection));
}

export function getUserDocumentTemplate(
  ownerUserId: number,
  templateId: number,
  connection: DatabaseConnection = getDatabase(),
): DocumentTemplateRecord {
  const row = connection.sqlite
    .prepare(`${templateSelect} where owner_user_id = ? and id = ?`)
    .get(idSchema.parse(ownerUserId), idSchema.parse(templateId)) as
    StoredTemplate | undefined;
  if (!row) throw new Error("Document template not found.");
  return mapTemplate(row, connection);
}

export function createDocumentTemplate(
  ownerUserId: number,
  input: DocumentTemplateInput,
  connection: DatabaseConnection = getDatabase(),
  storageUserId: number | null = null,
): DocumentTemplateRecord {
  const ownerId = idSchema.parse(ownerUserId);
  const value = templateInputSchema.parse(input);
  const required = JSON.stringify([...new Set(value.requiredPlaceholders)]);
  const now = Date.now();
  const result = connection.sqlite
    .prepare(
      `insert into document_templates
       (owner_user_id, storage_user_id, name, description, category_kind, source_file_id, naming_pattern,
        destination_strategy, required_placeholders, active, created_at, updated_at)
       values (?, ?, ?, ?, ?, ?, ?, 'offering_drive_folder', ?, ?, ?, ?)`,
    )
    .run(
      ownerId,
      storageUserId === null ? null : idSchema.parse(storageUserId),
      value.name,
      value.description,
      value.categoryKind,
      value.sourceFileId,
      value.namingPattern,
      required,
      value.active ? 1 : 0,
      now,
      now,
    );
  return getUserDocumentTemplate(
    ownerId,
    Number(result.lastInsertRowid),
    connection,
  );
}

export function updateDocumentTemplate(
  ownerUserId: number,
  templateId: number,
  input: DocumentTemplateInput,
  connection: DatabaseConnection = getDatabase(),
  storageUserId?: number | null,
): DocumentTemplateRecord {
  const ownerId = idSchema.parse(ownerUserId);
  const id = idSchema.parse(templateId);
  const value = templateInputSchema.parse(input);
  const result = connection.sqlite
    .prepare(
      `update document_templates
       set name = ?, description = ?, category_kind = ?, source_file_id = ?, naming_pattern = ?,
           required_placeholders = ?, active = ?,
           storage_user_id = coalesce(?, storage_user_id), updated_at = ?
       where id = ? and owner_user_id = ?`,
    )
    .run(
      value.name,
      value.description,
      value.categoryKind,
      value.sourceFileId,
      value.namingPattern,
      JSON.stringify([...new Set(value.requiredPlaceholders)]),
      value.active ? 1 : 0,
      storageUserId === undefined || storageUserId === null
        ? null
        : idSchema.parse(storageUserId),
      Date.now(),
      id,
      ownerId,
    );
  if (result.changes !== 1) throw new Error("Document template not found.");
  return getUserDocumentTemplate(ownerId, id, connection);
}

export function cloneDocumentTemplate(
  ownerUserId: number,
  templateId: number,
  name: string,
  connection: DatabaseConnection = getDatabase(),
): DocumentTemplateRecord {
  const ownerId = idSchema.parse(ownerUserId);
  const source = getUserDocumentTemplate(ownerId, templateId, connection);
  const cloneName = z.string().trim().min(1).max(160).parse(name);
  const clone = connection.sqlite.transaction(() => {
    const now = Date.now();
    const result = connection.sqlite
      .prepare(
        `insert into document_templates
         (owner_user_id, storage_user_id, base_template_id, name, description, category_kind, source_file_id,
          naming_pattern, destination_strategy, required_placeholders, active,
          created_at, updated_at)
         values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        ownerId,
        source.storageUserId,
        source.baseTemplateId ?? source.id,
        cloneName,
        source.description,
        source.categoryKind,
        source.sourceFileId,
        source.namingPattern,
        source.destinationStrategy,
        JSON.stringify(source.requiredPlaceholders),
        source.active ? 1 : 0,
        now,
        now,
      );
    const cloneId = Number(result.lastInsertRowid);
    const insert = connection.sqlite.prepare(
      `insert into document_template_sections
       (template_id, internal_key, display_title, type, sort_order, optional,
        initial_source, helper_text, created_at, updated_at)
       values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    source.sections.forEach((section) =>
      insert.run(
        cloneId,
        section.internalKey,
        section.displayTitle,
        section.type,
        section.sortOrder,
        section.optional ? 1 : 0,
        section.initialSource,
        section.helperText,
        now,
        now,
      ),
    );
    return cloneId;
  })();
  return getUserDocumentTemplate(ownerId, clone, connection);
}

export function deleteDocumentTemplate(
  ownerUserId: number,
  templateId: number,
  connection: DatabaseConnection = getDatabase(),
): void {
  const result = connection.sqlite
    .prepare(
      "delete from document_templates where id = ? and owner_user_id = ?",
    )
    .run(idSchema.parse(templateId), idSchema.parse(ownerUserId));
  if (result.changes !== 1) throw new Error("Document template not found.");
}

function normalizeSectionOrder(
  templateId: number,
  connection: DatabaseConnection,
) {
  const rows = connection.sqlite
    .prepare(
      "select id from document_template_sections where template_id = ? order by sort_order, id",
    )
    .all(templateId) as Array<{ id: number }>;
  const update = connection.sqlite.prepare(
    "update document_template_sections set sort_order = ?, updated_at = ? where id = ?",
  );
  const now = Date.now();
  rows.forEach((row, index) => update.run(index, now, row.id));
}

export function addDocumentTemplateSection(
  ownerUserId: number,
  templateId: number,
  input: DocumentTemplateSectionInput,
  connection: DatabaseConnection = getDatabase(),
): DocumentTemplateSection {
  const template = getUserDocumentTemplate(ownerUserId, templateId, connection);
  const value = sectionInputSchema.parse(input);
  const nextOrder = template.sections.length;
  const now = Date.now();
  const result = connection.sqlite
    .prepare(
      `insert into document_template_sections
       (template_id, internal_key, display_title, type, sort_order, optional,
        initial_source, helper_text, created_at, updated_at)
       values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      template.id,
      value.internalKey,
      value.displayTitle,
      value.type,
      nextOrder,
      value.optional ? 1 : 0,
      value.initialSource ?? null,
      value.helperText,
      now,
      now,
    );
  return listSections(template.id, connection).find(
    ({ id }) => id === Number(result.lastInsertRowid),
  )!;
}

export function updateDocumentTemplateSection(
  ownerUserId: number,
  templateId: number,
  sectionId: number,
  input: DocumentTemplateSectionInput,
  connection: DatabaseConnection = getDatabase(),
): DocumentTemplateSection {
  const template = getUserDocumentTemplate(ownerUserId, templateId, connection);
  const value = sectionInputSchema.parse(input);
  const result = connection.sqlite
    .prepare(
      `update document_template_sections
       set internal_key = ?, display_title = ?, type = ?, optional = ?,
           initial_source = ?, helper_text = ?, updated_at = ?
       where id = ? and template_id = ?`,
    )
    .run(
      value.internalKey,
      value.displayTitle,
      value.type,
      value.optional ? 1 : 0,
      value.initialSource ?? null,
      value.helperText,
      Date.now(),
      idSchema.parse(sectionId),
      template.id,
    );
  if (result.changes !== 1) throw new Error("Template section not found.");
  return listSections(template.id, connection).find(
    ({ id }) => id === sectionId,
  )!;
}

export function moveDocumentTemplateSection(
  ownerUserId: number,
  templateId: number,
  sectionId: number,
  direction: "up" | "down",
  connection: DatabaseConnection = getDatabase(),
): void {
  const template = getUserDocumentTemplate(ownerUserId, templateId, connection);
  connection.sqlite.transaction(() => {
    normalizeSectionOrder(template.id, connection);
    const sections = listSections(template.id, connection);
    const currentIndex = sections.findIndex(({ id }) => id === sectionId);
    if (currentIndex === -1) throw new Error("Template section not found.");
    const destinationIndex =
      direction === "up" ? currentIndex - 1 : currentIndex + 1;
    const destination = sections[destinationIndex];
    if (!destination) return;
    const update = connection.sqlite.prepare(
      "update document_template_sections set sort_order = ?, updated_at = ? where id = ? and template_id = ?",
    );
    const now = Date.now();
    update.run(destination.sortOrder, now, sectionId, template.id);
    update.run(
      sections[currentIndex].sortOrder,
      now,
      destination.id,
      template.id,
    );
  })();
}

export function deleteDocumentTemplateSection(
  ownerUserId: number,
  templateId: number,
  sectionId: number,
  connection: DatabaseConnection = getDatabase(),
): void {
  const template = getUserDocumentTemplate(ownerUserId, templateId, connection);
  connection.sqlite.transaction(() => {
    const result = connection.sqlite
      .prepare(
        "delete from document_template_sections where id = ? and template_id = ?",
      )
      .run(idSchema.parse(sectionId), template.id);
    if (result.changes !== 1) throw new Error("Template section not found.");
    normalizeSectionOrder(template.id, connection);
  })();
}
