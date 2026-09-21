import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";

import { z } from "zod";

import { recordAuditEvent } from "@/lib/audit";
import type { DatabaseConnection } from "@/lib/db/client";
import { getDatabase } from "@/lib/db/client";
import {
  ensureDriveFolderForUser,
  ensureDriveRootFolder,
  setDriveFileTrashed,
  trashDriveFile,
  updateDriveFileContent,
  uploadDriveFile,
} from "@/lib/google/drive";
import type { GoogleFetch } from "@/lib/google/oauth";
import { createProjectZip, readProjectZip } from "@/lib/project-archive";
import {
  buildProjectManifest,
  diffProjectManifests,
  projectLanguageSchema,
  projectTechnologySchema,
  type ProjectLanguage,
  type ProjectTechnology,
  type ProjectManifest,
  type ProjectSourceFile,
} from "@/lib/project-manifest";
import {
  buildStoragePath,
  getOfferingStorageContext,
  getStorageLayout,
} from "@/lib/storage-layout";

const idSchema = z.number().int().positive();
const projectInputSchema = z.object({
  offeringId: idSchema,
  name: z.string().trim().min(1).max(160),
  language: projectLanguageSchema,
  ignorePreset: projectLanguageSchema,
  technologies: z.array(projectTechnologySchema).max(30).default([]),
  description: z
    .string()
    .trim()
    .max(1000)
    .optional()
    .nullable()
    .transform((value) => value || null),
});
const previewTokenSchema = z.string().uuid();
const PREVIEW_TTL_MS = 60 * 60 * 1000;
const TEMP_ROOT = resolve(tmpdir(), "openstudyhub-project-uploads");

export type ProjectRecord = {
  id: number;
  ownerUserId: number;
  offeringId: number;
  subjectId: number;
  subjectName: string;
  subjectCode: string | null;
  name: string;
  language: ProjectLanguage;
  ignorePreset: ProjectLanguage;
  technologies: ProjectTechnology[];
  description: string | null;
  driveProjectFolderId: string | null;
  driveCurrentFolderId: string | null;
  driveVersionsFolderId: string | null;
  currentVersionNumber: number;
  syncStatus: "prepared" | "syncing" | "complete" | "failed";
  createdAt: number;
  updatedAt: number;
  archivedAt: number | null;
};

export type ProjectVersionRecord = {
  id: number;
  projectId: number;
  versionNumber: number;
  baseVersionNumber: number | null;
  message: string | null;
  archiveDriveFileId: string;
  manifestJson: string;
  addedCount: number;
  modifiedCount: number;
  removedCount: number;
  createdAt: number;
};

export class ProjectConflictError extends Error {
  constructor() {
    super("A newer project version already exists.");
    this.name = "ProjectConflictError";
  }
}

const projectSelect = `
  select p.id, p.owner_user_id as ownerUserId,
         p.offering_id as offeringId, so.subject_id as subjectId,
         s.name as subjectName, s.code as subjectCode,
         p.name, p.language, p.ignore_preset as ignorePreset,
         p.technologies_json as technologiesJson,
         p.description, p.drive_project_folder_id as driveProjectFolderId,
         p.drive_current_folder_id as driveCurrentFolderId,
         p.drive_versions_folder_id as driveVersionsFolderId,
         p.current_version_number as currentVersionNumber,
         p.sync_status as syncStatus, p.created_at as createdAt,
         p.updated_at as updatedAt, p.archived_at as archivedAt
  from projects p
  join subject_offerings so on so.id = p.offering_id
  join subjects s on s.id = so.subject_id`;

type ProjectRow = Omit<ProjectRecord, "technologies"> & {
  technologiesJson: string;
};

function parseProjectRow(row: ProjectRow): ProjectRecord {
  const parsed = z.array(projectTechnologySchema).safeParse(
    (() => {
      try {
        return JSON.parse(row.technologiesJson) as unknown;
      } catch {
        return [];
      }
    })(),
  );
  const record = {
    ...row,
    technologies: parsed.success ? parsed.data : [],
  };
  Reflect.deleteProperty(record, "technologiesJson");
  return record;
}

export function createProject(
  userId: number,
  input: z.input<typeof projectInputSchema>,
  connection: DatabaseConnection = getDatabase(),
): ProjectRecord {
  const ownerId = idSchema.parse(userId);
  const value = projectInputSchema.parse(input);
  const enrollment = connection.sqlite
    .prepare(`select 1 from enrollments where user_id = ? and offering_id = ?`)
    .get(ownerId, value.offeringId);
  if (!enrollment) {
    throw new Error("Offering is outside the user's academic context.");
  }
  const now = Date.now();
  const result = connection.sqlite
    .prepare(
      `insert into projects
       (owner_user_id, offering_id, name, language, ignore_preset,
        technologies_json, description, sync_status, created_at, updated_at)
       values (?, ?, ?, ?, ?, ?, ?, 'prepared', ?, ?)`,
    )
    .run(
      ownerId,
      value.offeringId,
      value.name,
      value.language,
      value.ignorePreset,
      JSON.stringify([...new Set(value.technologies)]),
      value.description,
      now,
      now,
    );
  return getUserProject(ownerId, Number(result.lastInsertRowid), connection);
}

export function listUserProjects(
  userId: number,
  offeringId?: number,
  connection: DatabaseConnection = getDatabase(),
): ProjectRecord[] {
  const ownerId = idSchema.parse(userId);
  const targetId = offeringId === undefined ? null : idSchema.parse(offeringId);
  const rows = connection.sqlite
    .prepare(
      `${projectSelect}
       where p.owner_user_id = ? and p.archived_at is null
         and (? is null or p.offering_id = ?)
       order by p.updated_at desc, p.id desc`,
    )
    .all(ownerId, targetId, targetId) as ProjectRow[];
  return rows.map(parseProjectRow);
}

export function getUserProject(
  userId: number,
  projectId: number,
  connection: DatabaseConnection = getDatabase(),
): ProjectRecord {
  const project = connection.sqlite
    .prepare(
      `${projectSelect}
       where p.id = ? and p.owner_user_id = ? and p.archived_at is null`,
    )
    .get(idSchema.parse(projectId), idSchema.parse(userId)) as
    ProjectRow | undefined;
  if (!project) throw new Error("Project not found.");
  return parseProjectRow(project);
}

export function archiveUserProject(
  userId: number,
  projectId: number,
  connection: DatabaseConnection = getDatabase(),
): void {
  const project = getUserProject(userId, projectId, connection);
  const now = Date.now();
  connection.sqlite.transaction(() => {
    connection.sqlite
      .prepare(
        `update projects set archived_at = ?, updated_at = ?
         where id = ? and owner_user_id = ? and archived_at is null`,
      )
      .run(now, now, project.id, project.ownerUserId);
    recordAuditEvent(
      {
        actorUserId: project.ownerUserId,
        action: "project.archive",
        targetType: "project",
        targetId: String(project.id),
        summary: "Project archived locally; Drive content retained",
      },
      connection,
    );
  })();
}

export function listProjectVersions(
  userId: number,
  projectId: number,
  connection: DatabaseConnection = getDatabase(),
): ProjectVersionRecord[] {
  getUserProject(userId, projectId, connection);
  return connection.sqlite
    .prepare(
      `select id, project_id as projectId, version_number as versionNumber,
              base_version_number as baseVersionNumber, message,
              archive_drive_file_id as archiveDriveFileId,
              manifest_json as manifestJson, added_count as addedCount,
              modified_count as modifiedCount, removed_count as removedCount,
              created_at as createdAt
       from project_versions where project_id = ?
       order by version_number desc`,
    )
    .all(projectId) as ProjectVersionRecord[];
}

export function getProjectVersion(
  userId: number,
  projectId: number,
  versionNumber: number,
  connection: DatabaseConnection = getDatabase(),
): ProjectVersionRecord {
  getUserProject(userId, projectId, connection);
  const version = connection.sqlite
    .prepare(
      `select id, project_id as projectId, version_number as versionNumber,
              base_version_number as baseVersionNumber, message,
              archive_drive_file_id as archiveDriveFileId,
              manifest_json as manifestJson, added_count as addedCount,
              modified_count as modifiedCount, removed_count as removedCount,
              created_at as createdAt
       from project_versions where project_id = ? and version_number = ?`,
    )
    .get(projectId, idSchema.parse(versionNumber)) as
    ProjectVersionRecord | undefined;
  if (!version) throw new Error("Project version not found.");
  return version;
}

function currentManifest(
  projectId: number,
  connection: DatabaseConnection,
): ProjectManifest | null {
  const files = connection.sqlite
    .prepare(
      `select relative_path as path, sha256, size_bytes as sizeBytes,
              mime_type as mimeType
       from project_files where project_id = ? order by relative_path`,
    )
    .all(projectId) as ProjectManifest["files"];
  return files.length ? { schemaVersion: 1, files } : null;
}

function assertTempArchivePath(path: string): string {
  const safe = resolve(path);
  if (!safe.startsWith(`${TEMP_ROOT}/`)) {
    throw new Error("Invalid temporary archive path.");
  }
  return safe;
}

async function cleanupExpiredPreviews(connection: DatabaseConnection) {
  const expired = connection.sqlite
    .prepare(
      `select token, temp_archive_path as tempArchivePath
       from project_upload_previews where expires_at < ?`,
    )
    .all(Date.now()) as Array<{ token: string; tempArchivePath: string }>;
  for (const preview of expired) {
    try {
      await unlink(assertTempArchivePath(preview.tempArchivePath));
    } catch {
      // Expired temp files may already have been removed by the host.
    }
    connection.sqlite
      .prepare("delete from project_upload_previews where token = ?")
      .run(preview.token);
  }
}

export async function prepareProjectUpload(
  userId: number,
  projectId: number,
  input: {
    files: ProjectSourceFile[];
    baseVersionNumber: number | null;
  },
  connection: DatabaseConnection = getDatabase(),
) {
  const project = getUserProject(userId, projectId, connection);
  if (
    project.currentVersionNumber > 0 &&
    input.baseVersionNumber !== project.currentVersionNumber
  ) {
    throw new ProjectConflictError();
  }
  if (project.currentVersionNumber === 0 && input.baseVersionNumber !== null) {
    throw new ProjectConflictError();
  }
  await cleanupExpiredPreviews(connection);
  const prepared = buildProjectManifest(input.files, project.ignorePreset);
  const diff = diffProjectManifests(
    currentManifest(project.id, connection),
    prepared.manifest,
  );
  const archive = await createProjectZip(prepared.accepted);
  await mkdir(TEMP_ROOT, { recursive: true, mode: 0o700 });
  const token = randomUUID();
  const tempArchivePath = join(TEMP_ROOT, `${token}.zip`);
  await writeFile(tempArchivePath, archive, { mode: 0o600, flag: "wx" });
  const now = Date.now();
  connection.sqlite
    .prepare(
      `insert into project_upload_previews
       (token, owner_user_id, project_id, base_version_number,
        temp_archive_path, manifest_json, ignored_json,
        added_count, modified_count, removed_count, created_at, expires_at)
       values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      token,
      userId,
      project.id,
      input.baseVersionNumber,
      tempArchivePath,
      JSON.stringify(prepared.manifest),
      JSON.stringify(prepared.ignored),
      diff.added.length,
      diff.modified.length,
      diff.removed.length,
      now,
      now + PREVIEW_TTL_MS,
    );
  return {
    token,
    manifest: prepared.manifest,
    ignored: prepared.ignored,
    diff,
    expiresAt: now + PREVIEW_TTL_MS,
  };
}

type PreviewRecord = {
  token: string;
  ownerUserId: number;
  projectId: number;
  baseVersionNumber: number | null;
  tempArchivePath: string;
  manifestJson: string;
  ignoredJson: string;
  addedCount: number;
  modifiedCount: number;
  removedCount: number;
  expiresAt: number;
};

export function getProjectUploadPreview(
  userId: number,
  token: string,
  connection: DatabaseConnection = getDatabase(),
): PreviewRecord {
  const preview = connection.sqlite
    .prepare(
      `select token, owner_user_id as ownerUserId, project_id as projectId,
              base_version_number as baseVersionNumber,
              temp_archive_path as tempArchivePath,
              manifest_json as manifestJson, ignored_json as ignoredJson,
              added_count as addedCount, modified_count as modifiedCount,
              removed_count as removedCount, expires_at as expiresAt
       from project_upload_previews
       where token = ? and owner_user_id = ? and expires_at >= ?`,
    )
    .get(
      previewTokenSchema.parse(token),
      idSchema.parse(userId),
      Date.now(),
    ) as PreviewRecord | undefined;
  if (!preview) throw new Error("Upload preview expired or unavailable.");
  return preview;
}

async function ensureProjectDriveStructure(
  project: ProjectRecord,
  connection: DatabaseConnection,
  fetchImpl: GoogleFetch,
) {
  const root = await ensureDriveRootFolder(project.ownerUserId, {
    connection,
    fetchImpl,
  });
  const layout = getStorageLayout(connection);
  const context = getOfferingStorageContext(
    project.ownerUserId,
    project.offeringId,
    connection,
  );
  const segments = buildStoragePath(layout, context, "projects");
  let parentId = root.id;
  for (const [index, name] of segments.entries()) {
    const folder = await ensureDriveFolderForUser(
      project.ownerUserId,
      {
        name,
        parentId,
        identityKey: `layout:${project.ownerUserId}:${project.offeringId}:projects:${index}`,
      },
      { connection, fetchImpl },
    );
    parentId = folder.id;
  }
  const projectFolder = await ensureDriveFolderForUser(
    project.ownerUserId,
    {
      name: project.name,
      parentId,
      identityKey: `project:${project.id}`,
    },
    { connection, fetchImpl },
  );
  const currentFolder = await ensureDriveFolderForUser(
    project.ownerUserId,
    {
      name: "Current",
      parentId: projectFolder.id,
      identityKey: `project:${project.id}:current`,
    },
    { connection, fetchImpl },
  );
  const versionsFolder = await ensureDriveFolderForUser(
    project.ownerUserId,
    {
      name: "Versions",
      parentId: projectFolder.id,
      identityKey: `project:${project.id}:versions`,
    },
    { connection, fetchImpl },
  );
  return { projectFolder, currentFolder, versionsFolder };
}

async function ensureProjectDirectory(
  project: ProjectRecord,
  relativeDirectory: string,
  currentFolderId: string,
  connection: DatabaseConnection,
  fetchImpl: GoogleFetch,
): Promise<string> {
  if (!relativeDirectory || relativeDirectory === ".") return currentFolderId;
  const segments = relativeDirectory.split("/");
  let path = "";
  let parentId = currentFolderId;
  for (const name of segments) {
    path = path ? `${path}/${name}` : name;
    const existing = connection.sqlite
      .prepare(
        `select drive_folder_id as driveFolderId
         from project_directories where project_id = ? and relative_path = ?`,
      )
      .get(project.id, path) as { driveFolderId: string } | undefined;
    if (existing) {
      parentId = existing.driveFolderId;
      continue;
    }
    const identity = createHash("sha256")
      .update(`${project.id}:${path}`)
      .digest("hex")
      .slice(0, 32);
    const folder = await ensureDriveFolderForUser(
      project.ownerUserId,
      { name, parentId, identityKey: `project-dir:${identity}` },
      { connection, fetchImpl },
    );
    connection.sqlite
      .prepare(
        `insert into project_directories
         (project_id, relative_path, drive_folder_id, updated_at)
         values (?, ?, ?, ?)
         on conflict(project_id, relative_path) do update set
           drive_folder_id = excluded.drive_folder_id,
           updated_at = excluded.updated_at`,
      )
      .run(project.id, path, folder.id, Date.now());
    parentId = folder.id;
  }
  return parentId;
}

export async function confirmProjectUpload(
  userId: number,
  token: string,
  messageInput: string | null,
  options: {
    connection?: DatabaseConnection;
    fetchImpl?: GoogleFetch;
  } = {},
) {
  const connection = options.connection ?? getDatabase();
  const fetchImpl = options.fetchImpl ?? fetch;
  const preview = getProjectUploadPreview(userId, token, connection);
  const project = getUserProject(userId, preview.projectId, connection);
  if (
    (project.currentVersionNumber === 0 &&
      preview.baseVersionNumber !== null) ||
    (project.currentVersionNumber > 0 &&
      preview.baseVersionNumber !== project.currentVersionNumber)
  ) {
    throw new ProjectConflictError();
  }
  const message = z
    .string()
    .trim()
    .max(500)
    .optional()
    .nullable()
    .transform((value) => value || null)
    .parse(messageInput);
  const archive = await readFile(
    assertTempArchivePath(preview.tempArchivePath),
  );
  const sources = await readProjectZip(archive);
  const prepared = buildProjectManifest(sources, project.ignorePreset);
  const expectedManifest = JSON.parse(preview.manifestJson) as ProjectManifest;
  const expectedMimeTypes = new Map(
    expectedManifest.files.map((file) => [file.path, file.mimeType]),
  );
  for (const file of prepared.accepted) {
    file.mimeType = expectedMimeTypes.get(file.path) ?? null;
  }
  for (const file of prepared.manifest.files) {
    file.mimeType = expectedMimeTypes.get(file.path) ?? null;
  }
  if (JSON.stringify(prepared.manifest) !== preview.manifestJson) {
    throw new Error("Upload preview integrity check failed.");
  }
  const previous = currentManifest(project.id, connection);
  const diff = diffProjectManifests(previous, prepared.manifest);
  if (
    diff.added.length !== preview.addedCount ||
    diff.modified.length !== preview.modifiedCount ||
    diff.removed.length !== preview.removedCount
  ) {
    throw new ProjectConflictError();
  }

  connection.sqlite
    .prepare(
      "update projects set sync_status = 'syncing', updated_at = ? where id = ? and owner_user_id = ?",
    )
    .run(Date.now(), project.id, userId);

  const createdRemoteIds: string[] = [];
  const trashedRemoteIds: string[] = [];
  let archiveDriveFileId: string | null = null;
  try {
    const folders = await ensureProjectDriveStructure(
      project,
      connection,
      fetchImpl,
    );
    const versionNumber = project.currentVersionNumber + 1;
    const archiveFile = await uploadDriveFile(
      userId,
      {
        name: `v${String(versionNumber).padStart(4, "0")}.zip`,
        parentFolderId: folders.versionsFolder.id,
        data: archive,
        mimeType: "application/zip",
        appProperties: {
          openStudyHubProjectId: String(project.id),
          openStudyHubProjectVersion: String(versionNumber),
        },
      },
      { connection, fetchImpl },
    );
    archiveDriveFileId = archiveFile.id;
    createdRemoteIds.push(archiveFile.id);

    const existingFiles = new Map(
      (
        connection.sqlite
          .prepare(
            `select relative_path as path, drive_file_id as driveFileId
             from project_files where project_id = ?`,
          )
          .all(project.id) as Array<{ path: string; driveFileId: string }>
      ).map((file) => [file.path, file.driveFileId]),
    );
    const syncedFiles = new Map<string, string>();
    for (const source of prepared.accepted) {
      const oldFileId = existingFiles.get(source.path);
      if (oldFileId && !diff.modified.includes(source.path)) {
        syncedFiles.set(source.path, oldFileId);
        continue;
      }
      if (oldFileId) {
        await updateDriveFileContent(
          userId,
          {
            fileId: oldFileId,
            name: basename(source.path),
            data: source.data,
            mimeType: source.mimeType,
          },
          { connection, fetchImpl },
        );
        syncedFiles.set(source.path, oldFileId);
      } else {
        const parentId = await ensureProjectDirectory(
          project,
          dirname(source.path),
          folders.currentFolder.id,
          connection,
          fetchImpl,
        );
        const uploaded = await uploadDriveFile(
          userId,
          {
            name: basename(source.path),
            parentFolderId: parentId,
            data: source.data,
            mimeType: source.mimeType,
            appProperties: {
              openStudyHubProjectId: String(project.id),
            },
          },
          { connection, fetchImpl },
        );
        createdRemoteIds.push(uploaded.id);
        syncedFiles.set(source.path, uploaded.id);
      }
    }
    for (const path of diff.removed) {
      const fileId = existingFiles.get(path);
      if (!fileId) continue;
      await trashDriveFile(userId, fileId, { connection, fetchImpl });
      trashedRemoteIds.push(fileId);
    }

    const now = Date.now();
    connection.sqlite.transaction(() => {
      connection.sqlite
        .prepare("delete from project_files where project_id = ?")
        .run(project.id);
      const insertFile = connection.sqlite.prepare(
        `insert into project_files
         (project_id, relative_path, sha256, size_bytes, drive_file_id,
          mime_type, updated_at)
         values (?, ?, ?, ?, ?, ?, ?)`,
      );
      for (const file of prepared.manifest.files) {
        insertFile.run(
          project.id,
          file.path,
          file.sha256,
          file.sizeBytes,
          syncedFiles.get(file.path),
          file.mimeType,
          now,
        );
      }
      connection.sqlite
        .prepare(
          `insert into project_versions
           (project_id, version_number, base_version_number, message,
            archive_drive_file_id, manifest_json, added_count,
            modified_count, removed_count, created_by_user_id, created_at)
           values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          project.id,
          versionNumber,
          preview.baseVersionNumber,
          message,
          archiveDriveFileId,
          JSON.stringify(prepared.manifest),
          diff.added.length,
          diff.modified.length,
          diff.removed.length,
          userId,
          now,
        );
      connection.sqlite
        .prepare(
          `update projects set
             drive_project_folder_id = ?, drive_current_folder_id = ?,
             drive_versions_folder_id = ?, current_version_number = ?,
             sync_status = 'complete', updated_at = ?
           where id = ? and owner_user_id = ?`,
        )
        .run(
          folders.projectFolder.id,
          folders.currentFolder.id,
          folders.versionsFolder.id,
          versionNumber,
          now,
          project.id,
          userId,
        );
      connection.sqlite
        .prepare("delete from project_upload_previews where token = ?")
        .run(preview.token);
      recordAuditEvent(
        {
          actorUserId: userId,
          action: "project.version_create",
          targetType: "project",
          targetId: String(project.id),
          summary: `Project version ${versionNumber} created (+${diff.added.length} ~${diff.modified.length} -${diff.removed.length})`,
        },
        connection,
      );
    })();
    await unlink(assertTempArchivePath(preview.tempArchivePath));
    return { versionNumber, diff };
  } catch (error) {
    for (const fileId of createdRemoteIds.reverse()) {
      try {
        await trashDriveFile(userId, fileId, { connection, fetchImpl });
      } catch {
        // Remote cleanup is best effort; the project remains failed locally.
      }
    }
    for (const fileId of trashedRemoteIds) {
      try {
        await setDriveFileTrashed(userId, fileId, false, {
          connection,
          fetchImpl,
        });
      } catch {
        // Retry can reconcile the remaining partial remote state.
      }
    }
    connection.sqlite
      .prepare(
        "update projects set sync_status = 'failed', updated_at = ? where id = ? and owner_user_id = ?",
      )
      .run(Date.now(), project.id, userId);
    throw error;
  }
}

export async function cancelProjectUploadPreview(
  userId: number,
  token: string,
  connection: DatabaseConnection = getDatabase(),
): Promise<void> {
  const preview = getProjectUploadPreview(userId, token, connection);
  connection.sqlite
    .prepare(
      "delete from project_upload_previews where token = ? and owner_user_id = ?",
    )
    .run(preview.token, userId);
  try {
    await unlink(assertTempArchivePath(preview.tempArchivePath));
  } catch {
    // Temp cleanup remains idempotent.
  }
}
