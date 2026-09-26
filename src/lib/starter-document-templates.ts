import { z } from "zod";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import type { DatabaseConnection } from "@/lib/db/client";
import { getDatabase } from "@/lib/db/client";
import { isUserEnrolled } from "@/lib/enrollments";
import { generateDocument } from "@/lib/document-workflows";
import { getServerEnvironment, type ServerEnvironment } from "@/lib/env";
import {
  addDocumentTemplateSection,
  createDocumentTemplate,
  deleteDocumentTemplate,
  type DocumentTemplateSectionInput,
} from "@/lib/document-templates";
import {
  copyDriveFile,
  ensureDriveFolderForUser,
  ensureDriveRootFolder,
  trashDriveFile,
  uploadDriveFile,
} from "@/lib/google/drive";
import type { GoogleFetch } from "@/lib/google/oauth";
import { resolveDriveStorageUser } from "@/lib/google/storage-owner";

const starterKeySchema = z.enum([
  "generic_activity",
  "programming_activity",
  "class_notes",
]);
export type StarterDocumentTemplateKey = z.infer<typeof starterKeySchema>;

type StarterDefinition = {
  key: StarterDocumentTemplateKey;
  filename: string;
  name: string;
  description: string;
  categoryKind: "activity" | "notes" | "documents";
  namingPattern: string;
  requiredPlaceholders: Array<
    "subject.name" | "students.names" | "document.date"
  >;
  sections: DocumentTemplateSectionInput[];
};

export const starterDocumentTemplates: StarterDefinition[] = [
  {
    key: "generic_activity",
    filename: "01_Atividade_Generica.docx",
    name: "Atividade",
    description: "Exemplo genérico de atividade acadêmica.",
    categoryKind: "activity",
    namingPattern: "{{subject.name}} - {{document.title}} - {{document.date}}",
    requiredPlaceholders: ["subject.name", "students.names", "document.date"],
    sections: [
      {
        internalKey: "question",
        displayTitle: "Questão",
        type: "text",
        optional: false,
        initialSource: "activity.prompt",
      },
      {
        internalKey: "answer",
        displayTitle: "Resposta",
        type: "text",
        optional: false,
      },
    ],
  },
  {
    key: "programming_activity",
    filename: "02_Atividade_Programacao_Generica.docx",
    name: "Atividade de programação",
    description: "Exemplo genérico com seções para código e resultado.",
    categoryKind: "activity",
    namingPattern: "{{subject.name}} - {{document.title}} - {{document.date}}",
    requiredPlaceholders: ["subject.name", "students.names", "document.date"],
    sections: [
      {
        internalKey: "question",
        displayTitle: "Questão",
        type: "text",
        optional: false,
        initialSource: "activity.prompt",
      },
      {
        internalKey: "answer",
        displayTitle: "Resposta",
        type: "text",
        optional: false,
      },
      {
        internalKey: "code",
        displayTitle: "Código",
        type: "code",
        optional: false,
      },
      {
        internalKey: "result",
        displayTitle: "Resultado",
        type: "text_or_image",
        optional: false,
      },
    ],
  },
  {
    key: "class_notes",
    filename: "03_Anotacoes_de_Aula_Generica.docx",
    name: "Anotações de aula",
    description: "Exemplo genérico de registro de aula.",
    categoryKind: "notes",
    namingPattern: "{{subject.name}} - Anotações - {{document.date}}",
    requiredPlaceholders: ["subject.name", "document.date"],
    sections: [
      {
        internalKey: "notes",
        displayTitle: "Anotações",
        type: "text",
        optional: false,
      },
      {
        internalKey: "summary",
        displayTitle: "Resumo",
        type: "text",
        optional: true,
      },
      {
        internalKey: "questions",
        displayTitle: "Dúvidas",
        type: "text",
        optional: true,
      },
    ],
  },
];

function getStarter(keyInput: string): StarterDefinition {
  const key = starterKeySchema.parse(keyInput);
  return starterDocumentTemplates.find((item) => item.key === key)!;
}

const bundledSettingPrefix = "starter_template.enabled.";

export function listBundledStarterTemplates(
  connection: DatabaseConnection = getDatabase(),
) {
  const settings = new Map(
    (
      connection.sqlite
        .prepare(
          "SELECT key,value FROM app_settings WHERE key LIKE 'starter_template.enabled.%'",
        )
        .all() as Array<{ key: string; value: string }>
    ).map(({ key, value }) => [key, value]),
  );
  return starterDocumentTemplates.map((template) => ({
    ...template,
    enabled: settings.get(bundledSettingPrefix + template.key) !== "0",
  }));
}

export function setBundledStarterEnabled(
  keyInput: string,
  enabled: boolean,
  connection: DatabaseConnection = getDatabase(),
) {
  const key = getStarter(keyInput).key;
  connection.sqlite
    .prepare(
      `INSERT INTO app_settings(key,value,updated_at) VALUES(?,?,?)
     ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=excluded.updated_at`,
    )
    .run(bundledSettingPrefix + key, enabled ? "1" : "0", Date.now());
}

export function readBundledStarter(
  keyInput: string,
  connection: DatabaseConnection = getDatabase(),
) {
  const template = listBundledStarterTemplates(connection).find(
    ({ key }) => key === starterKeySchema.parse(keyInput),
  );
  if (!template?.enabled) throw new Error("Modelo indisponível.");
  const path = resolve(
    /* turbopackIgnore: true */ process.cwd(),
    "assets",
    "starter-templates",
    template.filename,
  );
  return { template, content: readFileSync(path) };
}

export async function createGoogleDocumentFromStarter(
  ownerUserId: number,
  input: { key: string; title: string; offeringId: number },
  options: { connection?: DatabaseConnection; fetchImpl?: GoogleFetch } = {},
): Promise<number> {
  const ownerId = z.number().int().positive().parse(ownerUserId);
  const offeringId = z.number().int().positive().parse(input.offeringId);
  const title = z.string().trim().min(1).max(160).parse(input.title);
  const connection = options.connection ?? getDatabase();
  if (!isUserEnrolled(ownerId, offeringId, connection))
    throw new Error("Disciplina fora da sua matrícula.");
  const templateId = await importStarterDocumentTemplate(
    ownerId,
    input.key,
    options,
  );
  const generated = await generateDocument(
    ownerId,
    {
      templateId,
      offeringId,
      title,
      date: new Date().toISOString().slice(0, 10),
    },
    options,
  );
  return generated.id;
}

function starterSourceIds(environment: ServerEnvironment) {
  return {
    generic_activity: environment.GOOGLE_TEMPLATE_GENERIC_ACTIVITY_ID,
    programming_activity: environment.GOOGLE_TEMPLATE_PROGRAMMING_ACTIVITY_ID,
    class_notes: environment.GOOGLE_TEMPLATE_CLASS_NOTES_ID,
  } satisfies Record<StarterDocumentTemplateKey, string | undefined>;
}

export function getConfiguredStarterDocumentTemplateKeys(
  environment = getServerEnvironment(),
): Set<StarterDocumentTemplateKey> {
  return new Set(
    Object.entries(starterSourceIds(environment))
      .filter((entry): entry is [StarterDocumentTemplateKey, string] =>
        Boolean(entry[1]),
      )
      .map(([key]) => key),
  );
}

export async function importStarterDocumentTemplate(
  ownerUserId: number,
  keyInput: string,
  options: {
    connection?: DatabaseConnection;
    fetchImpl?: GoogleFetch;
    environment?: ServerEnvironment;
  } = {},
) {
  const ownerId = z.number().int().positive().parse(ownerUserId);
  const starter = getStarter(keyInput);
  const connection = options.connection ?? getDatabase();
  const fetchImpl = options.fetchImpl ?? fetch;
  const settingKey = `starter_template.imported.${ownerId}.${starter.key}`;
  const existing = connection.sqlite
    .prepare(
      `SELECT dt.id FROM app_settings s JOIN document_templates dt
     ON dt.id = CAST(s.value AS INTEGER) AND dt.owner_user_id = ?
     WHERE s.key = ?`,
    )
    .get(ownerId, settingKey) as { id: number } | undefined;
  if (existing) return existing.id;
  const sourceFileId = starterSourceIds(
    options.environment ?? getServerEnvironment(),
  )[starter.key];
  const { content } = readBundledStarter(starter.key, connection);
  const storageUserId = resolveDriveStorageUser(ownerId, null, { connection });
  const root = await ensureDriveRootFolder(storageUserId, {
    connection,
    fetchImpl,
  });
  const templatesFolder = await ensureDriveFolderForUser(
    storageUserId,
    {
      name: "_Templates",
      parentId: root.id,
      identityKey: "document-templates",
    },
    { connection, fetchImpl },
  );
  const imported = sourceFileId
    ? await copyDriveFile(
        storageUserId,
        {
          sourceFileId,
          name: `${starter.name} — OpenStudyHub`,
          parentFolderId: templatesFolder.id,
        },
        { connection, fetchImpl },
      )
    : await uploadDriveFile(
        storageUserId,
        {
          name: `${starter.name} — OpenStudyHub`,
          parentFolderId: templatesFolder.id,
          data: content,
          mimeType:
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          targetMimeType: "application/vnd.google-apps.document",
          appProperties: { openStudyHubType: "starter-template" },
        },
        { connection, fetchImpl },
      );

  let templateId: number | null = null;
  try {
    const template = createDocumentTemplate(
      ownerId,
      {
        name: starter.name,
        description: starter.description,
        categoryKind: starter.categoryKind,
        sourceFileId: imported.id,
        namingPattern: starter.namingPattern,
        requiredPlaceholders: starter.requiredPlaceholders,
        active: true,
      },
      connection,
      storageUserId,
    );
    templateId = template.id;
    for (const section of starter.sections) {
      addDocumentTemplateSection(ownerId, template.id, section, connection);
    }
    connection.sqlite
      .prepare(
        `INSERT INTO app_settings(key,value,updated_at) VALUES(?,?,?)
       ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=excluded.updated_at`,
      )
      .run(settingKey, String(template.id), Date.now());
    return template.id;
  } catch (error) {
    if (templateId !== null) {
      try {
        deleteDocumentTemplate(ownerId, templateId, connection);
      } catch {
        // Local rollback is best effort; the original error is more relevant.
      }
    }
    try {
      await trashDriveFile(storageUserId, imported.id, {
        connection,
        fetchImpl,
      });
    } catch {
      // Remote rollback is best effort and touches only this imported copy.
    }
    throw error;
  }
}
