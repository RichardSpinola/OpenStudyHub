import { ensureTemplateStorageFolder } from "./template-storage";
import { getDatabase, type DatabaseConnection } from "./db/client";
import { resolveDriveStorageUser } from "./google/storage-owner";
import {
  copyDriveFile,
  exportGoogleDocumentAsDocx,
  getDriveFileMetadata,
  trashDriveFile,
  uploadDriveFile,
} from "./google/drive";
import { validateDocumentTemplateSource } from "./document-workflows";
import { validateDocxPackage } from "./docx-template-import";
import type { GoogleFetch } from "./google/oauth";
export async function templateDestination(
  ownerId: number,
  storageUserId: number,
  options: { connection?: DatabaseConnection; fetchImpl?: GoogleFetch } = {},
) {
  return ensureTemplateStorageFolder(ownerId, storageUserId, options);
}
export async function copyGoogleTemplateSource(
  ownerId: number,
  sourceFileId: string,
  name: string,
  options: {
    connection?: DatabaseConnection;
    fetchImpl?: GoogleFetch;
    storageUserId?: number;
  } = {},
) {
  const connection = options.connection ?? getDatabase(),
    storageUserId =
      options.storageUserId ??
      resolveDriveStorageUser(ownerId, null, { connection });
  await validateDocumentTemplateSource(ownerId, sourceFileId, {
    ...options,
    connection,
  });
  const folder = await templateDestination(ownerId, storageUserId, {
    ...options,
    connection,
  });
  let copied;
  if (storageUserId === ownerId)
    copied = await copyDriveFile(
      storageUserId,
      { sourceFileId, name, parentFolderId: folder.id },
      { ...options, connection },
    );
  else {
    const data = await exportGoogleDocumentAsDocx(ownerId, sourceFileId, {
      ...options,
      connection,
    });
    await validateDocxPackage(data);
    copied = await uploadDriveFile(
      storageUserId,
      {
        name,
        parentFolderId: folder.id,
        data,
        mimeType:
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        targetMimeType: "application/vnd.google-apps.document",
        appProperties: { openStudyHubType: "document-template" },
      },
      { ...options, connection },
    );
  }
  try {
    const meta = await getDriveFileMetadata(storageUserId, copied.id, {
      ...options,
      connection,
    });
    if (
      meta.trashed ||
      meta.mimeType !== "application/vnd.google-apps.document"
    )
      throw new Error("A cópia não é um documento Google válido.");
    return { sourceFileId: copied.id, storageUserId };
  } catch (error) {
    await trashDriveFile(storageUserId, copied.id, {
      ...options,
      connection,
    }).catch(() => undefined);
    throw error;
  }
}
