import type { DatabaseConnection } from "../db/client";
import type { V2Database } from "./database";
import type { Actor } from "./actor";
import { isAdmin } from "./access";
import { recordAdminAction } from "./audit";
/** Operator-only reset. Stop writers and retain a verified recovery copy before calling. */
export function resetDriveLibraryRecords(
  db: V2Database,
  connection: DatabaseConnection,
  actor: Actor,
  confirmation: string,
) {
  if (!isAdmin(db, actor) || confirmation !== "RESET_DRIVE_LIBRARY")
    throw new Error("Reset exige Admin e confirmação explícita.");
  const count = (table: string) =>
    (
      connection.sqlite.prepare(`SELECT count(*) n FROM ${table}`).get() as {
        n: number;
      }
    ).n;
  const previous = {
    projects: count("projects"),
    documents: count("generated_documents"),
    templates: count("document_templates"),
    localDocuments: (
      db.prepare("SELECT count(*) n FROM local_documents").get() as {
        n: number;
      }
    ).n,
  };
  // Cascades remove versions/files/shares. No managed file is unlinked: the recovery copy remains usable.
  connection.sqlite.transaction(() => {
    connection.sqlite.exec(
      "DELETE FROM generated_documents; DELETE FROM document_templates; DELETE FROM projects;",
    );
    connection.sqlite
      .prepare("DELETE FROM app_settings WHERE key LIKE ? OR key LIKE ?")
      .run("project.%", "storage.drive_folder_previous.%");
    connection.sqlite.exec(
      "UPDATE offering_google_integrations SET drive_folder_id=NULL,drive_folder_name=NULL,drive_storage_user_id=NULL; UPDATE google_connections SET drive_root_folder_id=NULL;",
    );
  })();
  db.transaction(() => {
    db.exec("DELETE FROM project_shares_v2; DELETE FROM local_documents;");
    db.prepare(
      "UPDATE storage_backends SET root_ref=NULL WHERE name='Central Drive' AND kind='google-drive'",
    ).run();
    db.prepare(
      "UPDATE google_automation_v2 SET drive_status='pending',last_drive_check_at=NULL WHERE id=1",
    ).run();
    recordAdminAction(db, actor, "storage.library_reset", "storage_backend", 0);
  })();
  return previous;
}
