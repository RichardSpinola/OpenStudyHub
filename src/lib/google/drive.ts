import { z } from "zod";
import { createHash, randomUUID } from "node:crypto";

import { assertCanManageOffering } from "@/lib/academic-authority";
import { recordAuditEvent } from "@/lib/audit";
import type { DatabaseConnection } from "@/lib/db/client";
import { getDatabase } from "@/lib/db/client";
import { getInstitutionName } from "@/lib/institution";

import { getGoogleConnection, setGoogleDriveRootFolder } from "./connections";
import { getGoogleAccessToken, type GoogleFetch } from "./oauth";
import {
  getOfferingGoogleIntegration,
  setOfferingDriveFolder,
} from "./offering-integrations";
import {
  buildOfferingStoragePath,
  getOfferingStorageContextById,
  getStorageLayout,
} from "@/lib/storage-layout";

import { resolveDriveStorageUser } from "./storage-owner";

const DRIVE_FILES_ENDPOINT = "https://www.googleapis.com/drive/v3/files";
const DRIVE_UPLOAD_ENDPOINT =
  "https://www.googleapis.com/upload/drive/v3/files";
const idSchema = z.number().int().positive();
const driveFileSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  mimeType: z.string().optional(),
  webViewLink: z.string().optional(),
  modifiedTime: z.string().optional(),
  trashed: z.boolean().optional(),
});
const driveFileListSchema = z.object({ files: z.array(driveFileSchema) });

async function driveRequest(
  accessToken: string,
  url: URL | string,
  init: RequestInit,
  fetchImpl: GoogleFetch,
): Promise<Response> {
  return fetchImpl(url, {
    ...init,
    headers: {
      authorization: `Bearer ${accessToken}`,
      ...(init.body ? { "content-type": "application/json" } : {}),
      ...init.headers,
    },
    signal: AbortSignal.timeout(15_000),
  });
}

function desiredRootFolderName(connection: DatabaseConnection): string {
  const institution = getInstitutionName(connection).trim();
  return institution ? `${institution} - OSH` : "OpenStudyHub";
}

async function renameDriveFile(
  accessToken: string,
  fileId: string,
  name: string,
  fetchImpl: GoogleFetch,
) {
  const response = await driveRequest(
    accessToken,
    `${DRIVE_FILES_ENDPOINT}/${encodeURIComponent(fileId)}?fields=id,name,mimeType,webViewLink,trashed`,
    {
      method: "PATCH",
      body: JSON.stringify({ name }),
    },
    fetchImpl,
  );
  if (!response.ok) throw new Error("Drive file rename failed.");
  return driveFileSchema.parse(await response.json());
}

async function createFolder(
  accessToken: string,
  name: string,
  appProperties: Record<string, string>,
  fetchImpl: GoogleFetch,
  parentId?: string,
) {
  const response = await driveRequest(
    accessToken,
    `${DRIVE_FILES_ENDPOINT}?fields=id,name,mimeType,webViewLink`,
    {
      method: "POST",
      body: JSON.stringify({
        name,
        mimeType: "application/vnd.google-apps.folder",
        appProperties,
        ...(parentId ? { parents: [parentId] } : {}),
      }),
    },
    fetchImpl,
  );
  if (!response.ok) throw new Error("Drive folder creation failed.");
  return driveFileSchema.parse(await response.json());
}

export async function createDriveFolderForUser(
  userId: number,
  input: {
    name: string;
    parentId?: string;
    appProperties?: Record<string, string>;
  },
  options: {
    connection?: DatabaseConnection;
    fetchImpl?: GoogleFetch;
  } = {},
) {
  const ownerId = idSchema.parse(userId);
  const value = z
    .object({
      name: z.string().trim().min(1).max(255),
      parentId: z.string().trim().min(1).max(255).optional(),
      appProperties: z.record(z.string(), z.string().max(124)).optional(),
    })
    .parse(input);
  const connection = options.connection ?? getDatabase();
  const fetchImpl = options.fetchImpl ?? fetch;
  const accessToken = await getGoogleAccessToken(ownerId, {
    connection,
    fetchImpl,
  });
  return createFolder(
    accessToken,
    value.name,
    value.appProperties ?? {},
    fetchImpl,
    value.parentId,
  );
}

export async function ensureDriveFolderForUser(
  userId: number,
  input: {
    name: string;
    parentId: string;
    identityKey: string;
  },
  options: {
    connection?: DatabaseConnection;
    fetchImpl?: GoogleFetch;
  } = {},
) {
  const ownerId = idSchema.parse(userId);
  const value = z
    .object({
      name: z.string().trim().min(1).max(255),
      parentId: z.string().trim().min(1).max(255),
      identityKey: z.string().trim().min(1).max(124),
    })
    .parse(input);
  const connection = options.connection ?? getDatabase();
  const fetchImpl = options.fetchImpl ?? fetch;
  const accessToken = await getGoogleAccessToken(ownerId, {
    connection,
    fetchImpl,
  });
  const escapedParent = value.parentId.replaceAll("'", "\\'");
  const escapedKey = value.identityKey.replaceAll("'", "\\'");
  const url = new URL(DRIVE_FILES_ENDPOINT);
  url.searchParams.set(
    "q",
    `'${escapedParent}' in parents and trashed = false and mimeType = 'application/vnd.google-apps.folder' and appProperties has { key='openStudyHubIdentity' and value='${escapedKey}' }`,
  );
  url.searchParams.set("fields", "files(id,name,mimeType,webViewLink)");
  url.searchParams.set("pageSize", "2");
  const response = await driveRequest(
    accessToken,
    url,
    { method: "GET" },
    fetchImpl,
  );
  if (!response.ok) throw new Error("Drive folder lookup failed.");
  const existing = driveFileListSchema.parse(await response.json()).files[0];
  if (existing) return existing;
  return createFolder(
    accessToken,
    value.name,
    { openStudyHubIdentity: value.identityKey },
    fetchImpl,
    value.parentId,
  );
}

function multipartUploadBody(
  metadata: Record<string, unknown>,
  data: Buffer,
  mimeType: string,
) {
  const boundary = `openstudyhub-${randomUUID()}`;
  const body = Buffer.concat([
    Buffer.from(
      `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n--${boundary}\r\nContent-Type: ${mimeType}\r\n\r\n`,
    ),
    data,
    Buffer.from(`\r\n--${boundary}--`),
  ]);
  return { body, contentType: `multipart/related; boundary=${boundary}` };
}

export async function uploadDriveFile(
  userId: number,
  input: {
    name: string;
    parentFolderId: string;
    data: Buffer;
    mimeType?: string | null;
    appProperties?: Record<string, string>;
    targetMimeType?: string;
  },
  options: {
    connection?: DatabaseConnection;
    fetchImpl?: GoogleFetch;
  } = {},
) {
  const ownerId = idSchema.parse(userId);
  const value = z
    .object({
      name: z.string().trim().min(1).max(255),
      parentFolderId: z.string().trim().min(1).max(255),
      data: z.instanceof(Buffer),
      mimeType: z.string().trim().min(1).max(255).optional().nullable(),
      appProperties: z.record(z.string(), z.string().max(124)).optional(),
      targetMimeType: z.string().trim().min(1).max(255).optional(),
    })
    .parse(input);
  const connection = options.connection ?? getDatabase();
  const fetchImpl = options.fetchImpl ?? fetch;
  const accessToken = await getGoogleAccessToken(ownerId, {
    connection,
    fetchImpl,
  });
  const upload = multipartUploadBody(
    {
      name: value.name,
      parents: [value.parentFolderId],
      ...(value.appProperties ? { appProperties: value.appProperties } : {}),
      ...(value.targetMimeType ? { mimeType: value.targetMimeType } : {}),
    },
    value.data,
    value.mimeType ?? "application/octet-stream",
  );
  const response = await driveRequest(
    accessToken,
    `${DRIVE_UPLOAD_ENDPOINT}?uploadType=multipart&fields=id,name,mimeType,webViewLink,modifiedTime`,
    {
      method: "POST",
      headers: { "content-type": upload.contentType },
      body: upload.body as unknown as BodyInit,
    },
    fetchImpl,
  );
  if (!response.ok) throw new Error("Drive file upload failed.");
  return driveFileSchema.parse(await response.json());
}

export async function updateDriveFileContent(
  userId: number,
  input: {
    fileId: string;
    name: string;
    data: Buffer;
    mimeType?: string | null;
  },
  options: {
    connection?: DatabaseConnection;
    fetchImpl?: GoogleFetch;
  } = {},
) {
  const ownerId = idSchema.parse(userId);
  const value = z
    .object({
      fileId: z.string().trim().min(1).max(255),
      name: z.string().trim().min(1).max(255),
      data: z.instanceof(Buffer),
      mimeType: z.string().trim().min(1).max(255).optional().nullable(),
    })
    .parse(input);
  const connection = options.connection ?? getDatabase();
  const fetchImpl = options.fetchImpl ?? fetch;
  const accessToken = await getGoogleAccessToken(ownerId, {
    connection,
    fetchImpl,
  });
  const upload = multipartUploadBody(
    { name: value.name },
    value.data,
    value.mimeType ?? "application/octet-stream",
  );
  const response = await driveRequest(
    accessToken,
    `${DRIVE_UPLOAD_ENDPOINT}/${encodeURIComponent(value.fileId)}?uploadType=multipart&fields=id,name,mimeType,webViewLink,modifiedTime`,
    {
      method: "PATCH",
      headers: { "content-type": upload.contentType },
      body: upload.body as unknown as BodyInit,
    },
    fetchImpl,
  );
  if (!response.ok) throw new Error("Drive file update failed.");
  return driveFileSchema.parse(await response.json());
}

export async function setDriveFileTrashed(
  userId: number,
  fileId: string,
  trashed: boolean,
  options: {
    connection?: DatabaseConnection;
    fetchImpl?: GoogleFetch;
  } = {},
): Promise<void> {
  const ownerId = idSchema.parse(userId);
  const safeFileId = z.string().trim().min(1).max(255).parse(fileId);
  const connection = options.connection ?? getDatabase();
  const fetchImpl = options.fetchImpl ?? fetch;
  const accessToken = await getGoogleAccessToken(ownerId, {
    connection,
    fetchImpl,
  });
  const response = await driveRequest(
    accessToken,
    `${DRIVE_FILES_ENDPOINT}/${encodeURIComponent(safeFileId)}?fields=id,trashed`,
    { method: "PATCH", body: JSON.stringify({ trashed }) },
    fetchImpl,
  );
  if (!response.ok) throw new Error("Drive file state update failed.");
}

export async function downloadDriveFile(
  userId: number,
  fileId: string,
  options: {
    connection?: DatabaseConnection;
    fetchImpl?: GoogleFetch;
  } = {},
): Promise<Buffer> {
  const ownerId = idSchema.parse(userId);
  const safeFileId = z.string().trim().min(1).max(255).parse(fileId);
  const connection = options.connection ?? getDatabase();
  const fetchImpl = options.fetchImpl ?? fetch;
  const accessToken = await getGoogleAccessToken(ownerId, {
    connection,
    fetchImpl,
  });
  const response = await driveRequest(
    accessToken,
    `${DRIVE_FILES_ENDPOINT}/${encodeURIComponent(safeFileId)}?alt=media`,
    { method: "GET" },
    fetchImpl,
  );
  if (!response.ok) throw new Error("Drive file download failed.");
  return Buffer.from(await response.arrayBuffer());
}

export async function ensureDriveRootFolder(
  userId: number,
  options: {
    connection?: DatabaseConnection;
    fetchImpl?: GoogleFetch;
  } = {},
) {
  const ownerId = idSchema.parse(userId);
  const connection = options.connection ?? getDatabase();
  const fetchImpl = options.fetchImpl ?? fetch;
  const accessToken = await getGoogleAccessToken(ownerId, {
    connection,
    fetchImpl,
  });
  const current = getGoogleConnection(ownerId, connection);
  const rootName = desiredRootFolderName(connection);
  if (current?.driveRootFolderId) {
    const response = await driveRequest(
      accessToken,
      `${DRIVE_FILES_ENDPOINT}/${encodeURIComponent(current.driveRootFolderId)}?fields=id,name,mimeType,webViewLink,trashed`,
      { method: "GET" },
      fetchImpl,
    );
    if (response.ok) {
      const folder = driveFileSchema.parse(await response.json());
      if (!folder.trashed) {
        if (folder.name !== rootName) {
          const renamed = await renameDriveFile(
            accessToken,
            folder.id,
            rootName,
            fetchImpl,
          );
          recordAuditEvent(
            {
              actorUserId: ownerId,
              action: "google.drive_root_rename",
              targetType: "google_connection",
              targetId: String(ownerId),
              summary: `Drive root renamed to ${rootName}`,
            },
            connection,
          );
          return renamed;
        }
        return folder;
      }
    } else if (response.status !== 404) {
      throw new Error("Drive root folder lookup failed.");
    }
    setGoogleDriveRootFolder(ownerId, null, connection);
  }

  const folder = await createFolder(
    accessToken,
    rootName,
    { openStudyHubKind: "root" },
    fetchImpl,
  );
  setGoogleDriveRootFolder(ownerId, folder.id, connection);
  recordAuditEvent(
    {
      actorUserId: ownerId,
      action: "google.drive_root_create",
      targetType: "google_connection",
      targetId: String(ownerId),
      summary: `Drive root created: ${rootName}`,
    },
    connection,
  );
  return folder;
}

export async function createOfferingDriveFolder(
  actorUserId: number,
  offeringId: number,
  options: {
    connection?: DatabaseConnection;
    fetchImpl?: GoogleFetch;
    forceReprovision?: boolean;
  } = {},
) {
  const actorId = idSchema.parse(actorUserId);
  const targetId = idSchema.parse(offeringId);
  const connection = options.connection ?? getDatabase();
  assertCanManageOffering(actorId, targetId, connection);
  const existing = getOfferingGoogleIntegration(targetId, connection);
  if (
    !options.forceReprovision &&
    existing?.driveFolderId &&
    existing.driveFolderName
  ) {
    return { id: existing.driveFolderId, name: existing.driveFolderName };
  }

  const fetchImpl = options.fetchImpl ?? fetch;
  const storageUserId = resolveDriveStorageUser(
    actorId,
    existing?.driveStorageUserId,
    { connection },
  );
  const root = await ensureDriveRootFolder(storageUserId, {
    connection,
    fetchImpl,
  });
  const layout = getStorageLayout(connection);
  const context = getOfferingStorageContextById(targetId, connection);
  const path = buildOfferingStoragePath(layout, context);
  let parentId = root.id;
  let folder = root;
  for (const segment of path) {
    const digest = createHash("sha256")
      .update(`${parentId}\0${segment}`)
      .digest("hex")
      .slice(0, 40);
    folder = await ensureDriveFolderForUser(
      storageUserId,
      {
        name: segment,
        parentId,
        identityKey: `academic-path:${digest}`,
      },
      { connection, fetchImpl },
    );
    parentId = folder.id;
  }
  setOfferingDriveFolder(
    actorId,
    targetId,
    folder.id,
    folder.name,
    storageUserId,
    connection,
  );
  return folder;
}

export async function listDriveFolderItems(
  userId: number,
  folderId: string,
  options: {
    connection?: DatabaseConnection;
    fetchImpl?: GoogleFetch;
  } = {},
) {
  const ownerId = idSchema.parse(userId);
  const safeFolderId = z.string().trim().min(1).max(255).parse(folderId);
  const connection = options.connection ?? getDatabase();
  const fetchImpl = options.fetchImpl ?? fetch;
  const accessToken = await getGoogleAccessToken(ownerId, {
    connection,
    fetchImpl,
  });
  const url = new URL(DRIVE_FILES_ENDPOINT);
  url.searchParams.set(
    "q",
    `'${safeFolderId.replaceAll("'", "\\'")}' in parents and trashed = false`,
  );
  url.searchParams.set("fields", "files(id,name,mimeType,webViewLink)");
  url.searchParams.set("pageSize", "100");
  const response = await driveRequest(
    accessToken,
    url,
    { method: "GET" },
    fetchImpl,
  );
  if (!response.ok) throw new Error("Drive folder listing failed.");
  return driveFileListSchema.parse(await response.json()).files;
}

export async function getDriveFileMetadata(
  userId: number,
  fileId: string,
  options: {
    connection?: DatabaseConnection;
    fetchImpl?: GoogleFetch;
  } = {},
) {
  const ownerId = idSchema.parse(userId);
  const safeFileId = z.string().trim().min(1).max(255).parse(fileId);
  const connection = options.connection ?? getDatabase();
  const fetchImpl = options.fetchImpl ?? fetch;
  const accessToken = await getGoogleAccessToken(ownerId, {
    connection,
    fetchImpl,
  });
  const response = await driveRequest(
    accessToken,
    `${DRIVE_FILES_ENDPOINT}/${encodeURIComponent(safeFileId)}?fields=id,name,mimeType,webViewLink,modifiedTime,trashed`,
    { method: "GET" },
    fetchImpl,
  );
  if (!response.ok) throw new Error("Drive file lookup failed.");
  return driveFileSchema.parse(await response.json());
}

export async function copyDriveFile(
  userId: number,
  input: { sourceFileId: string; name: string; parentFolderId: string },
  options: {
    connection?: DatabaseConnection;
    fetchImpl?: GoogleFetch;
  } = {},
) {
  const ownerId = idSchema.parse(userId);
  const value = z
    .object({
      sourceFileId: z.string().trim().min(1).max(255),
      name: z.string().trim().min(1).max(255),
      parentFolderId: z.string().trim().min(1).max(255),
    })
    .parse(input);
  const connection = options.connection ?? getDatabase();
  const fetchImpl = options.fetchImpl ?? fetch;
  const accessToken = await getGoogleAccessToken(ownerId, {
    connection,
    fetchImpl,
  });
  const response = await driveRequest(
    accessToken,
    `${DRIVE_FILES_ENDPOINT}/${encodeURIComponent(value.sourceFileId)}/copy?fields=id,name,mimeType,webViewLink,modifiedTime`,
    {
      method: "POST",
      body: JSON.stringify({
        name: value.name,
        parents: [value.parentFolderId],
      }),
    },
    fetchImpl,
  );
  if (!response.ok) throw new Error("Drive template copy failed.");
  return driveFileSchema.parse(await response.json());
}

export async function trashDriveFile(
  userId: number,
  fileId: string,
  options: {
    connection?: DatabaseConnection;
    fetchImpl?: GoogleFetch;
  } = {},
): Promise<void> {
  await setDriveFileTrashed(userId, fileId, true, options);
}
