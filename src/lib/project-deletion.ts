import { randomUUID } from "node:crypto";
import { unlink } from "node:fs/promises";
import { getDatabase, type DatabaseConnection } from "./db/client";
import { getProjectDriveStorageUser } from "./projects";
import { permanentlyDeleteDriveFile } from "./google/drive";
import type { GoogleFetch } from "./google/oauth";
import { removeLocalProjectArchive } from "./project-local-storage";
import { withV2Db } from "./v2/runtime-database";
import { recordAuditEvent } from "./audit";

export async function deleteOwnedProject(
  userId: number,
  projectId: number,
  confirmation: string,
  options: { connection?: DatabaseConnection; fetchImpl?: GoogleFetch } = {},
) {
  const connection = options.connection ?? getDatabase(),
    db = connection.sqlite;
  const project = db
    .prepare(
      "SELECT id,name,owner_user_id ownerUserId,storage_backend storageBackend,drive_project_folder_id driveProjectFolderId FROM projects WHERE id=? AND owner_user_id=?",
    )
    .get(projectId, userId) as
    | {
        id: number;
        name: string;
        ownerUserId: number;
        storageBackend: "local" | "google-drive";
        driveProjectFolderId: string | null;
      }
    | undefined;
  if (!project) throw new Error("Projeto não encontrado ou sem permissão.");
  if (confirmation !== project.name)
    throw new Error(
      "Digite o nome exato do projeto para confirmar a exclusão definitiva.",
    );
  const nonce = randomUUID(),
    now = Date.now();
  db.transaction(() => {
    db.prepare(
      "DELETE FROM project_upload_claims WHERE project_id=? AND heartbeat_at<?",
    ).run(projectId, now - 120000);
    if (
      db
        .prepare("SELECT 1 FROM project_upload_claims WHERE project_id=?")
        .get(projectId)
    )
      throw new Error(
        "Há um envio em andamento. Aguarde a conclusão antes de excluir.",
      );
    db.prepare(
      "INSERT INTO project_upload_claims(token,claim_id,project_id,owner_user_id,claimed_at,heartbeat_at) VALUES(?,?,?,?,?,?)",
    ).run(nonce, nonce, projectId, userId, now, now);
  })();
  const timer = setInterval(() => {
    db.prepare(
      "UPDATE project_upload_claims SET heartbeat_at=? WHERE project_id=? AND claim_id=?",
    ).run(Date.now(), projectId, nonce);
  }, 15000);
  try {
    const versions = db
      .prepare(
        "SELECT archive_drive_file_id ref FROM project_versions WHERE project_id=?",
      )
      .all(projectId) as { ref: string }[];
    if (project.storageBackend === "local") {
      for (const { ref } of versions) {
        try {
          await removeLocalProjectArchive(connection, ref);
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
        }
      }
    } else {
      // Only this project's dedicated folder, never an institution/course root.
      if (project.driveProjectFolderId) {
        const storageUserId = getProjectDriveStorageUser(project, connection);
        const other = db
          .prepare(
            "SELECT 1 FROM projects WHERE id<>? AND drive_project_folder_id=?",
          )
          .get(projectId, project.driveProjectFolderId);
        const root = db
          .prepare(
            "SELECT 1 FROM google_connections WHERE drive_root_folder_id=?",
          )
          .get(project.driveProjectFolderId);
        let centralRoot = false;
        if (process.env.OPENSTUDYHUB_V2_ENABLED === "1")
          centralRoot = withV2Db((v2) =>
            Boolean(
              v2
                .prepare("SELECT 1 FROM storage_backends WHERE root_ref=?")
                .get(project.driveProjectFolderId),
            ),
          );
        if (other || root || centralRoot)
          throw new Error(
            "A pasta não é exclusiva deste projeto. Confira o vínculo antes de excluir.",
          );
        await permanentlyDeleteDriveFile(
          storageUserId,
          project.driveProjectFolderId,
          { ...options, connection },
        );
      } else if (versions.length) {
        throw new Error(
          "O projeto tem arquivos mas não tem uma pasta exclusiva vinculada. Confira o armazenamento antes de excluir.",
        );
      }
    }
    const previews = db
      .prepare(
        "SELECT temp_archive_path path FROM project_upload_previews WHERE project_id=?",
      )
      .all(projectId) as { path: string }[];
    // Staging files are app-created private files, with paths constrained to its staging directory.
    const { projectStagingRoot } = await import("./project-local-storage");
    const { resolve, dirname } = await import("node:path");
    for (const { path } of previews)
      if (dirname(resolve(path)) === projectStagingRoot(connection)) {
        try {
          await unlink(path);
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
        }
      }
    if (process.env.OPENSTUDYHUB_V2_ENABLED === "1")
      withV2Db((v2) => {
        v2.prepare(
          "DELETE FROM project_shares_v2 WHERE legacy_project_id=?",
        ).run(projectId);
      });
    db.transaction(() => {
      db.prepare("DELETE FROM app_settings WHERE key IN (?,?,?)").run(
        `project.storage_user.${projectId}`,
        `project.sync_error.${projectId}`,
        `project.retry.${userId}.${projectId}`,
      );
      db.prepare("DELETE FROM projects WHERE id=? AND owner_user_id=?").run(
        projectId,
        userId,
      );
      recordAuditEvent(
        {
          actorUserId: userId,
          action: "project.delete",
          targetType: "project",
          targetId: String(projectId),
          summary:
            "Project and stored files permanently deleted after name confirmation",
        },
        connection,
      );
    })();
  } finally {
    clearInterval(timer);
    db.prepare(
      "DELETE FROM project_upload_claims WHERE project_id=? AND claim_id=?",
    ).run(projectId, nonce);
  }
}
