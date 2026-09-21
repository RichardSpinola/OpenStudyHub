import { z } from "zod";

import type { DatabaseConnection } from "@/lib/db/client";
import { getDatabase } from "@/lib/db/client";
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
  const sourceFileId = starterSourceIds(
    options.environment ?? getServerEnvironment(),
  )[starter.key];
  if (!sourceFileId) {
    throw new Error("Starter document template is not configured.");
  }
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
  const imported = await copyDriveFile(
    storageUserId,
    {
      sourceFileId,
      name: `${starter.name} — OpenStudyHub`,
      parentFolderId: templatesFolder.id,
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
