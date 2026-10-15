import {
  projectStagingRoot,
  saveLocalProjectArchive,
  readLocalProjectArchive,
  readLocalProjectSource,
  removeLocalProjectArchive,
} from "./project-local-storage";
import { sharedProjectIds } from "./v2/project-sharing";
import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";

import { z } from "zod";

import { recordAuditEvent } from "@/lib/audit";
import type { DatabaseConnection } from "@/lib/db/client";
import { getDatabase } from "@/lib/db/client";
import {
  driveFolderExistsForUser,
  ensureDriveFolderForUser,
  ensureDriveRootFolder,
  setDriveFileTrashed,
  trashDriveFile,
  uploadDriveFile,
} from "@/lib/google/drive";
import type { GoogleFetch } from "@/lib/google/oauth";
import { resolveDriveStorageUser } from "@/lib/google/storage-owner";
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
  suggestProjectLanguage,
} from "@/lib/project-manifest";
import {
  buildProjectStoragePath,
  getStorageLayout,
  getOfferingStorageContext,
} from "@/lib/storage-layout";
import { withV2Db } from "@/lib/v2/runtime-database";

const idSchema = z.number().int().positive();
const projectInputSchema = z.object({
  storageBackend: z.enum(["local", "google-drive"]).default("google-drive"),
  offeringId: idSchema.nullable().default(null),
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
  offeringId: number | null;
  subjectId: number | null;
  subjectName: string;
  subjectCode: string | null;
  name: string;
  language: ProjectLanguage;
  ignorePreset: ProjectLanguage;
  technologies: ProjectTechnology[];
  description: string | null;
  storageBackend: "local" | "google-drive";
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
         coalesce(s.name, 'Projeto pessoal') as subjectName, s.code as subjectCode,
         p.name, p.language, p.ignore_preset as ignorePreset,
         p.technologies_json as technologiesJson,
         p.description, p.storage_backend as storageBackend, p.drive_project_folder_id as driveProjectFolderId,
         p.drive_current_folder_id as driveCurrentFolderId,
         p.drive_versions_folder_id as driveVersionsFolderId,
         p.current_version_number as currentVersionNumber,
         p.sync_status as syncStatus, p.created_at as createdAt,
         p.updated_at as updatedAt, p.archived_at as archivedAt
  from projects p
  left join subject_offerings so on so.id = p.offering_id
  left join subjects s on s.id = so.subject_id`;

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
  if (
    !connection.sqlite
      .prepare("SELECT 1 FROM users WHERE id=? AND active=1")
      .get(ownerId)
  )
    throw new Error("Active owner required.");
  if (value.offeringId !== null) {
    const enrollment = connection.sqlite
      .prepare("SELECT 1 FROM enrollments WHERE user_id=? AND offering_id=?")
      .get(ownerId, value.offeringId);
    if (!enrollment)
      throw new Error("Offering is outside the user's academic context.");
  }
  const now = Date.now();
  const result = connection.sqlite
    .prepare(
      `insert into projects
       (owner_user_id, offering_id, name, language, ignore_preset,
        technologies_json, description, storage_backend, sync_status, created_at, updated_at)
       values (?, ?, ?, ?, ?, ?, ?, ?, 'prepared', ?, ?)`,
    )
    .run(
      ownerId,
      value.offeringId,
      value.name,
      value.language,
      value.ignorePreset,
      JSON.stringify([...new Set(value.technologies)]),
      value.description,
      value.storageBackend,
      now,
      now,
    );
  return getUserProject(ownerId, Number(result.lastInsertRowid), connection);
}

export function updateProjectTechnology(
  userId: number,
  projectId: number,
  input: { language: ProjectLanguage; technologies: ProjectTechnology[] },
  connection: DatabaseConnection = getDatabase(),
): ProjectRecord {
  const project = getUserProject(userId, projectId, connection);
  if (project.ownerUserId !== userId)
    throw new Error("Este projeto foi compartilhado somente para leitura.");
  const language = projectLanguageSchema.parse(input.language);
  const technologies = [
    ...new Set(
      z.array(projectTechnologySchema).max(30).parse(input.technologies),
    ),
  ];
  connection.sqlite
    .prepare(
      "UPDATE projects SET language=?,technologies_json=?,updated_at=? WHERE id=? AND owner_user_id=? AND archived_at IS NULL",
    )
    .run(
      language,
      JSON.stringify(technologies),
      Date.now(),
      project.id,
      project.ownerUserId,
    );
  return getUserProject(userId, projectId, connection);
}

export function listUserProjects(
  userId: number,
  offeringId?: number,
  connection: DatabaseConnection = getDatabase(),
): ProjectRecord[] {
  const ownerId = idSchema.parse(userId);
  const targetId = offeringId === undefined ? null : idSchema.parse(offeringId);
  const shared = [
    ...sharedProjectIds(ownerId),
    ...groupSharedProjectIds(ownerId, connection),
  ];
  const rows = connection.sqlite
    .prepare(
      `${projectSelect}
       where (p.owner_user_id = ? OR p.id IN (SELECT value FROM json_each(?))) and p.archived_at is null
         and (? is null or p.offering_id = ?)
       order by p.updated_at desc, p.id desc`,
    )
    .all(ownerId, JSON.stringify(shared), targetId, targetId) as ProjectRow[];
  return rows.map(parseProjectRow);
}

export function getUserProject(
  userId: number,
  projectId: number,
  connection: DatabaseConnection = getDatabase(),
): ProjectRecord {
  const project = connection.sqlite
    .prepare(`${projectSelect} WHERE p.id=? AND p.archived_at IS NULL`)
    .get(idSchema.parse(projectId)) as ProjectRow | undefined;
  if (
    !project ||
    (project.ownerUserId !== idSchema.parse(userId) &&
      !sharedProjectIds(userId).includes(project.id) &&
      !groupSharedProjectIds(userId, connection).includes(project.id))
  )
    throw new Error("Project not found.");
  return parseProjectRow(project);
}

export function getProjectDriveStorageUser(
  project: Pick<ProjectRecord, "id" | "ownerUserId" | "driveProjectFolderId">,
  connection: DatabaseConnection = getDatabase(),
): number {
  if (process.env.OPENSTUDYHUB_V2_ENABLED !== "1") return project.ownerUserId;
  const stored = connection.sqlite
    .prepare("SELECT value FROM app_settings WHERE key=?")
    .get(`project.storage_user.${project.id}`) as { value: string } | undefined;
  if (stored) return idSchema.parse(Number(stored.value));
  // Existing projects without this setting retain their original Drive owner.
  if (project.driveProjectFolderId) return project.ownerUserId;
  return resolveDriveStorageUser(project.ownerUserId, null, { connection });
}

export function archiveUserProject(
  userId: number,
  projectId: number,
  connection: DatabaseConnection = getDatabase(),
): void {
  const project = getUserProject(userId, projectId, connection);
  if (project.ownerUserId !== userId)
    throw new Error("Este projeto foi compartilhado somente para leitura.");
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

export function listProjectFiles(
  userId: number,
  projectId: number,
  connection: DatabaseConnection = getDatabase(),
): Array<{
  path: string;
  sizeBytes: number;
  mimeType: string | null;
  driveFileId: string;
}> {
  getUserProject(userId, projectId, connection);
  return connection.sqlite
    .prepare(
      `SELECT relative_path AS path, size_bytes AS sizeBytes,
            mime_type AS mimeType, drive_file_id AS driveFileId
     FROM project_files WHERE project_id = ? ORDER BY relative_path`,
    )
    .all(projectId) as Array<{
    path: string;
    sizeBytes: number;
    mimeType: string | null;
    driveFileId: string;
  }>;
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

function assertTempArchivePath(
  path: string,
  connection: DatabaseConnection,
): string {
  const absolute = resolve(path);
  if (
    ![TEMP_ROOT, projectStagingRoot(connection)].includes(dirname(absolute)) ||
    !/^[0-9a-f-]{36}\.zip$/.test(basename(absolute))
  )
    throw new Error("Invalid project staging path.");
  return absolute;
}

export async function cleanupExpiredPreviews(connection: DatabaseConnection) {
  connection.sqlite
    .prepare("DELETE FROM project_upload_claims WHERE heartbeat_at<=?")
    .run(Date.now() - 120000);
  const expired = connection.sqlite
    .prepare(
      `select token, temp_archive_path as tempArchivePath
       from project_upload_previews where expires_at < ? AND token NOT IN (SELECT token FROM project_upload_claims)`,
    )
    .all(Date.now()) as Array<{ token: string; tempArchivePath: string }>;
  for (const preview of expired) {
    try {
      await unlink(assertTempArchivePath(preview.tempArchivePath, connection));
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
  if (project.ownerUserId !== userId)
    throw new Error("Este projeto foi compartilhado somente para leitura.");
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
  const stagingRoot = projectStagingRoot(connection);
  await mkdir(stagingRoot, { recursive: true, mode: 0o700 });
  const token = randomUUID();
  const tempArchivePath = join(stagingRoot, `${token}.zip`);
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

export function getProjectRetryPreview(
  userId: number,
  projectId: number,
  connection: DatabaseConnection = getDatabase(),
): PreviewRecord | null {
  getUserProject(userId, projectId, connection);
  const setting = connection.sqlite
    .prepare("SELECT value FROM app_settings WHERE key = ?")
    .get(`project.retry.${userId}.${projectId}`) as
    { value: string } | undefined;
  const pending = connection.sqlite
    .prepare(
      "SELECT token value FROM project_upload_previews WHERE project_id=? AND owner_user_id=? AND expires_at>=? ORDER BY created_at DESC LIMIT 1",
    )
    .get(projectId, userId, Date.now()) as { value: string } | undefined;
  if (!setting && !pending) return null;
  try {
    const preview = getProjectUploadPreview(
      userId,
      (setting ?? pending)!.value,
      connection,
    );
    return preview.projectId === projectId ? preview : null;
  } catch {
    return null;
  }
}

async function ensureProjectDriveStructure(
  project: ProjectRecord,
  storageUserId: number,
  connection: DatabaseConnection,
  fetchImpl: GoogleFetch,
) {
  let projectFolder: { id: string; name: string } | undefined;
  if (project.driveProjectFolderId) {
    const available = await driveFolderExistsForUser(
      storageUserId,
      project.driveProjectFolderId,
      { connection, fetchImpl },
    );
    if (!available) {
      throw new Error(
        "A pasta já vinculada a este projeto está ausente no Drive. Verifique ou restaure essa pasta antes de sincronizar; nenhuma pasta duplicada foi criada.",
      );
    }
    projectFolder = { id: project.driveProjectFolderId, name: project.name };
  }
  const context =
    project.offeringId === null
      ? null
      : getOfferingStorageContext(
          project.ownerUserId,
          project.offeringId,
          connection,
        );
  if (context && process.env.OPENSTUDYHUB_V2_ENABLED === "1") {
    const shortName = withV2Db(
      (db) =>
        db
          .prepare(
            `SELECT p.short_name shortName FROM legacy_offering_links l JOIN offerings o ON o.id=l.offering_id JOIN programs p ON p.id=o.program_id WHERE l.legacy_offering_id=?`,
          )
          .get(project.offeringId) as { shortName: string | null } | undefined,
    )?.shortName;
    if (shortName?.trim()) context.program.shortName = shortName.trim();
  }
  if (!projectFolder) {
    const root = await ensureDriveRootFolder(storageUserId, {
      connection,
      fetchImpl,
    });
    let parentId = root.id;
    for (const name of context
      ? buildProjectStoragePath(context, getStorageLayout(connection))
      : ["Pessoais", `Pessoa-${project.ownerUserId}`, "Projetos"]) {
      const identity = createHash("sha256")
        .update(`${parentId}\0${name}`)
        .digest("hex")
        .slice(0, 40);
      const folder = await ensureDriveFolderForUser(
        storageUserId,
        { name, parentId, identityKey: `project-path:${identity}` },
        { connection, fetchImpl },
      );
      parentId = folder.id;
    }
    projectFolder = await ensureDriveFolderForUser(
      storageUserId,
      { name: project.name, parentId, identityKey: `project:${project.id}` },
      { connection, fetchImpl },
    );
  }
  if (!projectFolder) throw new Error("A pasta do projeto não foi localizada.");
  const currentFolder = await ensureDriveFolderForUser(
    storageUserId,
    {
      name: "Current",
      parentId: projectFolder.id,
      identityKey: `project:${project.id}:current`,
    },
    { connection, fetchImpl },
  );
  const versionsFolder = await ensureDriveFolderForUser(
    storageUserId,
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
  storageUserId: number,
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
      storageUserId,
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

async function performProjectUpload(
  userId: number,
  token: string,
  messageInput: string | null,
  options: {
    claimId: string;
    connection?: DatabaseConnection;
    fetchImpl?: GoogleFetch;
    language?: ProjectLanguage;
    technologies?: ProjectTechnology[];
  },
) {
  const connection = options.connection ?? getDatabase();
  const fetchImpl = options.fetchImpl ?? fetch;
  const preview = getProjectUploadPreview(userId, token, connection);
  const project = getUserProject(userId, preview.projectId, connection);
  if (project.ownerUserId !== userId)
    throw new Error("Este projeto foi compartilhado somente para leitura.");
  const storageUserId =
    project.storageBackend === "google-drive"
      ? getProjectDriveStorageUser(project, connection)
      : userId;
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
    assertTempArchivePath(preview.tempArchivePath, connection),
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
  const chosenLanguage =
    options.language ??
    (project.language === "other"
      ? suggestProjectLanguage(prepared.manifest.files)
      : project.language);
  const diff = diffProjectManifests(previous, prepared.manifest);
  if (
    diff.added.length !== preview.addedCount ||
    diff.modified.length !== preview.modifiedCount ||
    diff.removed.length !== preview.removedCount
  ) {
    throw new ProjectConflictError();
  }

  if (project.storageBackend === "local") {
    const ref = await saveLocalProjectArchive(connection, archive);
    const versionNumber = project.currentVersionNumber + 1,
      now = Date.now();
    try {
      connection.sqlite.transaction(() => {
        assertUploadClaim(
          connection,
          project.id,
          preview.token,
          options.claimId,
        );
        const saved = connection.sqlite
          .prepare(
            "UPDATE projects SET current_version_number=?,sync_status='complete',language=?,technologies_json=?,updated_at=? WHERE id=? AND owner_user_id=? AND current_version_number=? AND archived_at IS NULL",
          )
          .run(
            versionNumber,
            chosenLanguage,
            JSON.stringify(options.technologies ?? project.technologies),
            now,
            project.id,
            userId,
            project.currentVersionNumber,
          );
        if (saved.changes !== 1) throw new ProjectConflictError();
        connection.sqlite
          .prepare("DELETE FROM project_files WHERE project_id=?")
          .run(project.id);
        const insert = connection.sqlite.prepare(
          "INSERT INTO project_files(project_id,relative_path,sha256,size_bytes,drive_file_id,mime_type,updated_at) VALUES(?,?,?,?,?,?,?)",
        );
        for (const file of prepared.manifest.files)
          insert.run(
            project.id,
            file.path,
            file.sha256,
            file.sizeBytes,
            ref,
            file.mimeType,
            now,
          );
        connection.sqlite
          .prepare(
            "INSERT INTO project_versions(project_id,version_number,base_version_number,message,archive_drive_file_id,manifest_json,added_count,modified_count,removed_count,created_by_user_id,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)",
          )
          .run(
            project.id,
            versionNumber,
            preview.baseVersionNumber,
            message,
            ref,
            preview.manifestJson,
            diff.added.length,
            diff.modified.length,
            diff.removed.length,
            userId,
            now,
          );
        recordUploadReceipt(connection, preview.token, userId, project.id, {
          versionNumber,
          diff,
        });
        connection.sqlite
          .prepare("DELETE FROM project_upload_previews WHERE token=?")
          .run(preview.token);
        connection.sqlite
          .prepare("DELETE FROM app_settings WHERE key IN (?,?)")
          .run(
            `project.sync_error.${project.id}`,
            `project.retry.${userId}.${project.id}`,
          );
        recordAuditEvent(
          {
            actorUserId: userId,
            action: "project.version_create",
            targetType: "project",
            targetId: String(project.id),
            summary: `Local project version ${versionNumber} created`,
          },
          connection,
        );
      })();
    } catch (error) {
      await removeLocalProjectArchive(connection, ref).catch(() => undefined);
      throw error;
    }
    await unlink(
      assertTempArchivePath(preview.tempArchivePath, connection),
    ).catch(() => undefined);
    return { versionNumber, diff };
  }
  connection.sqlite
    .prepare(
      "update projects set sync_status = 'syncing', updated_at = ? where id = ? and owner_user_id = ?",
    )
    .run(Date.now(), project.id, userId);

  const createdRemoteIds: string[] = [];
  const trashedRemoteIds: string[] = [];
  let archiveDriveFileId: string | null = null;
  let stage = "criação das pastas no Drive";
  try {
    const folders = await ensureProjectDriveStructure(
      project,
      storageUserId,
      connection,
      fetchImpl,
    );
    const versionNumber = project.currentVersionNumber + 1;
    stage = "envio do ZIP da versão ao Drive";
    const archiveFile = await uploadDriveFile(
      storageUserId,
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
      stage = `envio do arquivo ${source.path}`;
      const oldFileId = existingFiles.get(source.path);
      if (oldFileId && !diff.modified.includes(source.path)) {
        syncedFiles.set(source.path, oldFileId);
        continue;
      }
      {
        const parentId = await ensureProjectDirectory(
          project,
          storageUserId,
          dirname(source.path),
          folders.currentFolder.id,
          connection,
          fetchImpl,
        );
        const uploaded = await uploadDriveFile(
          storageUserId,
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
    stage = "substituição dos arquivos antigos no Drive";
    for (const path of [...diff.removed, ...diff.modified]) {
      const fileId = existingFiles.get(path);
      if (!fileId) continue;
      await trashDriveFile(storageUserId, fileId, { connection, fetchImpl });
      trashedRemoteIds.push(fileId);
    }

    stage = "gravação dos metadados e da versão local";
    const now = Date.now();
    connection.sqlite.transaction(() => {
      assertUploadClaim(connection, project.id, preview.token, options.claimId);
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
             language = ?, sync_status = 'complete', updated_at = ?,
             technologies_json = ?
           where id = ? and owner_user_id = ?`,
        )
        .run(
          folders.projectFolder.id,
          folders.currentFolder.id,
          folders.versionsFolder.id,
          versionNumber,
          chosenLanguage,
          now,
          JSON.stringify(options.technologies ?? project.technologies),
          project.id,
          userId,
        );
      connection.sqlite
        .prepare(
          `INSERT INTO app_settings(key,value,updated_at) VALUES(?,?,?)
           ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=excluded.updated_at`,
        )
        .run(`project.storage_user.${project.id}`, String(storageUserId), now);
      recordUploadReceipt(connection, preview.token, userId, project.id, {
        versionNumber,
        diff,
      });
      connection.sqlite
        .prepare("delete from project_upload_previews where token = ?")
        .run(preview.token);
      connection.sqlite
        .prepare("DELETE FROM app_settings WHERE key = ?")
        .run(`project.sync_error.${project.id}`);
      connection.sqlite
        .prepare("DELETE FROM app_settings WHERE key = ?")
        .run(`project.retry.${userId}.${project.id}`);
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
    await unlink(
      assertTempArchivePath(preview.tempArchivePath, connection),
    ).catch(() => undefined);
    return { versionNumber, diff };
  } catch (error) {
    // A superseded attempt must not alter files or overwrite the replacement attempt status.
    assertUploadClaim(connection, project.id, preview.token, options.claimId);
    for (const fileId of createdRemoteIds.reverse()) {
      try {
        await trashDriveFile(storageUserId, fileId, { connection, fetchImpl });
      } catch {
        // Remote cleanup is best effort; the project remains failed locally.
      }
    }
    for (const fileId of trashedRemoteIds) {
      try {
        await setDriveFileTrashed(storageUserId, fileId, false, {
          connection,
          fetchImpl,
        });
      } catch {
        // Retry can reconcile the remaining partial remote state.
      }
    }
    if (
      error instanceof Error &&
      error.message.startsWith("A pasta já vinculada a este projeto")
    ) {
      stage = error.message;
    }
    connection.sqlite
      .prepare(
        "update projects set sync_status = 'failed', updated_at = ? where id = ? and owner_user_id = ?",
      )
      .run(Date.now(), project.id, userId);
    connection.sqlite
      .prepare(
        `INSERT INTO app_settings(key,value,updated_at) VALUES(?,?,?)
       ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=excluded.updated_at`,
      )
      .run(`project.sync_error.${project.id}`, stage, Date.now());
    connection.sqlite
      .prepare(
        `INSERT INTO app_settings(key,value,updated_at) VALUES(?,?,?)
         ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=excluded.updated_at`,
      )
      .run(`project.retry.${userId}.${project.id}`, preview.token, Date.now());
    throw error;
  }
}

export function getProjectSyncFailureStage(
  projectId: number,
  connection: DatabaseConnection = getDatabase(),
): string | null {
  const result = connection.sqlite
    .prepare("SELECT value FROM app_settings WHERE key = ?")
    .get(`project.sync_error.${idSchema.parse(projectId)}`) as
    { value: string } | undefined;
  return result?.value ?? null;
}

export async function cancelProjectUploadPreview(
  userId: number,
  token: string,
  connection: DatabaseConnection = getDatabase(),
): Promise<void> {
  const preview = getProjectUploadPreview(userId, token, connection);
  if (
    connection.sqlite
      .prepare(
        "SELECT 1 FROM project_upload_claims WHERE token=? AND heartbeat_at>?",
      )
      .get(token, Date.now() - 120000)
  )
    throw new Error("Um envio está em andamento. Aguarde antes de cancelar.");
  connection.sqlite
    .prepare(
      "delete from project_upload_previews where token = ? and owner_user_id = ?",
    )
    .run(preview.token, userId);
  try {
    await unlink(assertTempArchivePath(preview.tempArchivePath, connection));
  } catch {
    // Temp cleanup remains idempotent.
  }
}

function assertUploadClaim(
  connection: DatabaseConnection,
  projectId: number,
  token: string,
  claimId: string,
) {
  if (
    !connection.sqlite
      .prepare(
        "SELECT 1 FROM project_upload_claims WHERE project_id=? AND token=? AND claim_id=?",
      )
      .get(projectId, token, claimId)
  )
    throw new ProjectConflictError();
}
function recordUploadReceipt(
  connection: DatabaseConnection,
  token: string,
  userId: number,
  projectId: number,
  result: {
    versionNumber: number;
    diff: ReturnType<typeof diffProjectManifests>;
  },
) {
  connection.sqlite
    .prepare(
      "INSERT INTO project_upload_receipts(token,project_id,owner_user_id,version_number,result_json,completed_at) VALUES(?,?,?,?,?,?)",
    )
    .run(
      token,
      projectId,
      userId,
      result.versionNumber,
      JSON.stringify(result),
      Date.now(),
    );
}
export async function confirmProjectUpload(
  userId: number,
  token: string,
  messageInput: string | null,
  options: {
    expectedProjectId?: number;
    connection?: DatabaseConnection;
    fetchImpl?: GoogleFetch;
    language?: ProjectLanguage;
    technologies?: ProjectTechnology[];
  } = {},
) {
  const connection = options.connection ?? getDatabase();
  previewTokenSchema.parse(token);
  idSchema.parse(userId);
  const receipt = connection.sqlite
    .prepare(
      "SELECT project_id id,result_json result FROM project_upload_receipts WHERE token=? AND owner_user_id=?",
    )
    .get(token, userId) as { id: number; result: string } | undefined;
  if (receipt) {
    if (
      options.expectedProjectId !== undefined &&
      receipt.id !== options.expectedProjectId
    )
      throw new ProjectConflictError();
    getUserProject(userId, receipt.id, connection);
    return JSON.parse(receipt.result) as {
      versionNumber: number;
      diff: ReturnType<typeof diffProjectManifests>;
    };
  }
  const preview = getProjectUploadPreview(userId, token, connection),
    project = getUserProject(userId, preview.projectId, connection);
  if (
    options.expectedProjectId !== undefined &&
    project.id !== options.expectedProjectId
  )
    throw new ProjectConflictError();
  if (project.ownerUserId !== userId)
    throw new Error("Somente o proprietário pode enviar versões.");
  const claimId = randomUUID(),
    now = Date.now();
  connection.sqlite.transaction(() => {
    const claim = connection.sqlite
      .prepare(
        "SELECT heartbeat_at heartbeat FROM project_upload_claims WHERE project_id=?",
      )
      .get(project.id) as { heartbeat: number } | undefined;
    if (claim && claim.heartbeat > now - 120000)
      throw new Error(
        "Este projeto já tem um envio em andamento. Aguarde antes de confirmar novamente.",
      );
    connection.sqlite
      .prepare(
        "DELETE FROM project_upload_claims WHERE project_id=? AND heartbeat_at<=?",
      )
      .run(project.id, now - 120000);
    connection.sqlite
      .prepare(
        "INSERT INTO project_upload_claims(token,claim_id,project_id,owner_user_id,claimed_at,heartbeat_at) VALUES(?,?,?,?,?,?)",
      )
      .run(token, claimId, project.id, userId, now, now);
  })();
  connection.sqlite
    .prepare(
      "INSERT INTO app_settings(key,value,updated_at) VALUES(?,?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=excluded.updated_at",
    )
    .run(
      `project.sync_error.${project.id}`,
      "validação da prévia e conferência do pacote",
      Date.now(),
    );
  const heartbeat = setInterval(() => {
    connection.sqlite
      .prepare(
        "UPDATE project_upload_claims SET heartbeat_at=? WHERE token=? AND claim_id=?",
      )
      .run(Date.now(), token, claimId);
  }, 15000);
  heartbeat.unref();
  const baseFetch = options.fetchImpl ?? fetch;
  const guardedFetch: GoogleFetch = async (input, init) => {
    assertUploadClaim(connection, project.id, token, claimId);
    const response = await baseFetch(input, init);
    assertUploadClaim(connection, project.id, token, claimId);
    return response;
  };
  try {
    return await performProjectUpload(userId, token, messageInput, {
      ...options,
      claimId,
      connection,
      fetchImpl: guardedFetch,
    });
  } finally {
    clearInterval(heartbeat);
    connection.sqlite
      .prepare("DELETE FROM project_upload_claims WHERE token=? AND claim_id=?")
      .run(token, claimId);
  }
}
export async function downloadProjectVersion(
  userId: number,
  projectId: number,
  versionNumber: number,
  options: { connection?: DatabaseConnection; fetchImpl?: GoogleFetch } = {},
) {
  const connection = options.connection ?? getDatabase();
  const project = getUserProject(userId, projectId, connection),
    version = getProjectVersion(userId, projectId, versionNumber, connection);
  if (project.storageBackend === "local")
    return readLocalProjectArchive(connection, version.archiveDriveFileId);
  const { downloadDriveFile } = await import("./google/drive");
  return downloadDriveFile(
    getProjectDriveStorageUser(project, connection),
    version.archiveDriveFileId,
    options,
  );
}
export async function readProjectSource(
  userId: number,
  projectId: number,
  path: string,
  options: {
    connection?: DatabaseConnection;
    fetchImpl?: GoogleFetch;
    maxBytes?: number;
  } = {},
) {
  const connection = options.connection ?? getDatabase(),
    project = getUserProject(userId, projectId, connection);
  const file = listProjectFiles(userId, projectId, connection).find(
    (f) => f.path === path,
  );
  if (!file) throw new Error("Arquivo não encontrado.");
  if (options.maxBytes && file.sizeBytes > options.maxBytes)
    throw new Error("Drive file exceeds preview limit.");
  if (project.storageBackend === "local") {
    const bytes = await readLocalProjectSource(
      connection,
      file.driveFileId,
      path,
    );
    if (
      bytes.length !== file.sizeBytes ||
      createHash("sha256").update(bytes).digest("hex") !==
        (
          connection.sqlite
            .prepare(
              "SELECT sha256 FROM project_files WHERE project_id=? AND relative_path=?",
            )
            .get(projectId, path) as { sha256: string }
        ).sha256
    )
      throw new Error("O arquivo não passou na verificação de integridade.");
    return bytes;
  }
  const { downloadDriveFile } = await import("./google/drive");
  return downloadDriveFile(
    getProjectDriveStorageUser(project, connection),
    file.driveFileId,
    options,
  );
}

export function listArchivedProjects(
  userId: number,
  connection: DatabaseConnection = getDatabase(),
) {
  return (
    connection.sqlite
      .prepare(
        projectSelect +
          " WHERE p.owner_user_id=? AND p.archived_at IS NOT NULL ORDER BY p.updated_at DESC",
      )
      .all(idSchema.parse(userId)) as ProjectRow[]
  ).map(parseProjectRow);
}
export function restoreUserProject(
  userId: number,
  projectId: number,
  connection: DatabaseConnection = getDatabase(),
) {
  if (
    !connection.sqlite
      .prepare("SELECT 1 FROM users WHERE id=? AND active=1")
      .get(idSchema.parse(userId))
  )
    throw new Error("Conta inativa.");
  const result = connection.sqlite
    .prepare(
      "UPDATE projects SET archived_at=NULL,updated_at=? WHERE id=? AND owner_user_id=? AND archived_at IS NOT NULL",
    )
    .run(Date.now(), idSchema.parse(projectId), userId);
  if (!result.changes) throw new Error("Projeto arquivado não encontrado.");
  return getUserProject(userId, projectId, connection);
}

export function projectPreviewDiff(
  userId: number,
  token: string,
  connection: DatabaseConnection = getDatabase(),
) {
  const preview = getProjectUploadPreview(userId, token, connection);
  getUserProject(userId, preview.projectId, connection);
  return diffProjectManifests(
    currentManifest(preview.projectId, connection),
    JSON.parse(preview.manifestJson) as ProjectManifest,
  );
}

export function groupSharedProjectIds(
  userId: number,
  connection: DatabaseConnection = getDatabase(),
) {
  return (
    connection.sqlite
      .prepare(
        "SELECT DISTINCT ps.project_id id FROM project_group_shares ps JOIN study_groups g ON g.id=ps.group_id AND g.archived_at IS NULL JOIN study_group_members m ON m.group_id=g.id AND m.user_id=? JOIN projects p ON p.id=ps.project_id AND p.archived_at IS NULL JOIN users owner ON owner.id=p.owner_user_id AND owner.active=1 JOIN users recipient ON recipient.id=m.user_id AND recipient.active=1",
      )
      .all(idSchema.parse(userId)) as { id: number }[]
  ).map((r) => r.id);
}
export function setProjectGroupShare(
  userId: number,
  projectId: number,
  groupId: number,
  enabled: boolean,
  connection: DatabaseConnection = getDatabase(),
) {
  const project = getUserProject(userId, projectId, connection);
  if (project.ownerUserId !== userId)
    throw new Error("Somente o proprietário pode compartilhar.");
  idSchema.parse(groupId);
  if (
    enabled &&
    !connection.sqlite
      .prepare(
        "SELECT 1 FROM study_groups g JOIN study_group_members m ON m.group_id=g.id AND m.user_id=? WHERE g.id=? AND g.archived_at IS NULL",
      )
      .get(userId, groupId)
  )
    throw new Error("Escolha um grupo do qual você participa.");
  if (enabled)
    connection.sqlite
      .prepare(
        "INSERT INTO project_group_shares VALUES(?,?) ON CONFLICT DO NOTHING",
      )
      .run(projectId, groupId);
  else
    connection.sqlite
      .prepare(
        "DELETE FROM project_group_shares WHERE project_id=? AND group_id=?",
      )
      .run(projectId, groupId);
}
export function listProjectGroupShares(
  userId: number,
  projectId: number,
  connection: DatabaseConnection = getDatabase(),
) {
  const p = getUserProject(userId, projectId, connection);
  if (p.ownerUserId !== userId)
    throw new Error("Somente o proprietário pode ver o compartilhamento.");
  return connection.sqlite
    .prepare(
      "SELECT g.id,g.name FROM project_group_shares ps JOIN study_groups g ON g.id=ps.group_id WHERE ps.project_id=?",
    )
    .all(projectId) as { id: number; name: string }[];
}
