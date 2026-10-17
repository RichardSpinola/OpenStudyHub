import { getDatabase, type DatabaseConnection } from "./db/client";
import {
  ensureDriveRootFolder,
  ensureDriveFolderForUser,
} from "./google/drive";
import type { GoogleFetch } from "./google/oauth";
import { drivePersonFolderName } from "./storage-layout";
export async function ensureTemplateStorageFolder(
  ownerId: number,
  storageUserId: number,
  options: { connection?: DatabaseConnection; fetchImpl?: GoogleFetch } = {},
) {
  const connection = options.connection ?? getDatabase();
  const root = await ensureDriveRootFolder(storageUserId, {
    ...options,
    connection,
  });
  const models = await ensureDriveFolderForUser(
    storageUserId,
    { name: "Modelos", parentId: root.id, identityKey: "document-templates" },
    { ...options, connection },
  );
  return ensureDriveFolderForUser(
    storageUserId,
    {
      name: drivePersonFolderName(ownerId, connection),
      parentId: models.id,
      identityKey: `private-templates-owner:${ownerId}`,
    },
    { ...options, connection },
  );
}
