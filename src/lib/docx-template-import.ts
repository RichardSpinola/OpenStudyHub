import yauzl from "yauzl";
import { z } from "zod";

import type { DatabaseConnection } from "@/lib/db/client";
import { getDatabase } from "@/lib/db/client";
import {
  createDocumentTemplate,
  type DocumentTemplateRecord,
} from "@/lib/document-templates";
import {
  ensureDriveFolderForUser,
  ensureDriveRootFolder,
  getDriveFileMetadata,
  trashDriveFile,
  uploadDriveFile,
} from "@/lib/google/drive";
import type { GoogleFetch } from "@/lib/google/oauth";
import { resolveDriveStorageUser } from "@/lib/google/storage-owner";

const DOCX_MIME =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const GOOGLE_DOC_MIME = "application/vnd.google-apps.document";
export const docxTemplateLimitBytes = 10 * 1024 * 1024;

export async function validateDocxPackage(data: Buffer): Promise<void> {
  if (!data.length || data.length > docxTemplateLimitBytes) {
    throw new Error("Invalid DOCX size.");
  }
  await new Promise<void>((resolve, reject) => {
    yauzl.fromBuffer(
      data,
      { lazyEntries: true, validateEntrySizes: true },
      (error, archive) => {
        if (error || !archive)
          return reject(new Error("Invalid DOCX package."));
        let total = 0;
        let contentTypes = false;
        let document = false;
        let settled = false;
        const fail = () => {
          if (settled) return;
          settled = true;
          archive.close();
          reject(new Error("Invalid DOCX package."));
        };
        archive.on("entry", (entry) => {
          if (entry.fileName.includes("..") || entry.fileName.startsWith("/"))
            return fail();
          total += entry.uncompressedSize;
          if (total > 50 * 1024 * 1024) return fail();
          if (entry.fileName === "[Content_Types].xml") contentTypes = true;
          if (entry.fileName === "word/document.xml") document = true;
          archive.readEntry();
        });
        archive.on("error", fail);
        archive.on("end", () => {
          if (settled) return;
          settled = true;
          if (!contentTypes || !document)
            return reject(new Error("Invalid DOCX package."));
          resolve();
        });
        archive.readEntry();
      },
    );
  });
}

export async function importDocxTemplate(
  ownerUserId: number,
  input: {
    name: string;
    description?: string;
    categoryKind?: "activity" | "notes" | "documents" | "custom";
    filename: string;
    data: Buffer;
    namingPattern?: string;
  },
  options: { connection?: DatabaseConnection; fetchImpl?: GoogleFetch } = {},
): Promise<DocumentTemplateRecord> {
  const value = z
    .object({
      name: z.string().trim().min(1).max(120),
      description: z.string().trim().max(500).optional().default(""),
      categoryKind: z
        .enum(["activity", "notes", "documents", "custom"])
        .optional()
        .default("documents"),
      filename: z.string().trim().min(1).max(255),
      data: z.instanceof(Buffer),
      namingPattern: z
        .string()
        .trim()
        .max(255)
        .optional()
        .default("{{subject.name}} - {{document.title}}"),
    })
    .parse(input);
  if (!value.filename.toLowerCase().endsWith(".docx"))
    throw new Error("Invalid DOCX filename.");
  await validateDocxPackage(value.data);
  const connection = options.connection ?? getDatabase();
  const fetchImpl = options.fetchImpl ?? fetch;
  const storageUserId = resolveDriveStorageUser(ownerUserId, null, {
    connection,
  });
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
  const remote = await uploadDriveFile(
    storageUserId,
    {
      name: value.name,
      parentFolderId: templatesFolder.id,
      data: value.data,
      mimeType: DOCX_MIME,
      targetMimeType: GOOGLE_DOC_MIME,
      appProperties: { openStudyHubType: "document-template" },
    },
    { connection, fetchImpl },
  );
  const validated = await getDriveFileMetadata(storageUserId, remote.id, {
    connection,
    fetchImpl,
  });
  if (validated.trashed || validated.mimeType !== GOOGLE_DOC_MIME) {
    await trashDriveFile(storageUserId, remote.id, {
      connection,
      fetchImpl,
    }).catch(() => undefined);
    throw new Error("DOCX conversion did not create a Google Document.");
  }
  try {
    return createDocumentTemplate(
      ownerUserId,
      {
        name: value.name,
        description: value.description,
        categoryKind: value.categoryKind,
        sourceFileId: remote.id,
        namingPattern: value.namingPattern,
        requiredPlaceholders: [],
        active: true,
      },
      connection,
      storageUserId,
    );
  } catch (error) {
    await trashDriveFile(storageUserId, remote.id, {
      connection,
      fetchImpl,
    }).catch(() => undefined);
    throw error;
  }
}
