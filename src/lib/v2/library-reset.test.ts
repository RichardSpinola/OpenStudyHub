import { describe, it, expect } from "vitest";
import { createMigratedTestDatabase } from "../test-database";
import { openV2Database, migrateV2 } from "./database";
import { seedV2Fake } from "./fixtures";
import { resetDriveLibraryRecords } from "./library-reset";
import { adminActor, userActor } from "./actor";
describe("explicit library reset with preserved notes and Google", () => {
  it("clears library items and folder links for every account while preserving notes, Classroom and connections", () => {
    const legacy = createMigratedTestDatabase();
    const db = openV2Database(":memory:");
    migrateV2(db);
    seedV2Fake(db);
    try {
      legacy.sqlite
        .exec(`INSERT INTO users(id,display_name,login,password_hash,role) VALUES(1,'One','one','fake','member'),(2,'Two','two','fake','member');
    INSERT INTO programs(id,name) VALUES(1,'Program'); INSERT INTO subjects(id,name) VALUES(1,'Subject'); INSERT INTO academic_periods(id,label,starts_on,ends_on) VALUES(1,'2026','2026-01-01','2026-12-31');INSERT INTO subject_offerings(id,subject_id,program_id,academic_period_id) VALUES(1,1,1,1);
    INSERT INTO notes(owner_user_id,title,content) VALUES(1,'Keep note','Original content'),(2,'Other note','Other content');
    INSERT INTO projects(owner_user_id,name,language,ignore_preset) VALUES(1,'One project','other','other'),(2,'Two project','other','other');
    INSERT INTO document_templates(id,owner_user_id,name,source_file_id,naming_pattern,destination_strategy) VALUES(1,1,'Old model','missing-doc','{{document.title}}','offering_drive_folder');
    INSERT INTO generated_documents(owner_user_id,template_id,offering_id,drive_file_id,web_view_link,name) VALUES(1,1,1,'old-generated','https://example.com','Old generated');
    INSERT INTO offering_google_integrations(offering_id,drive_folder_id,drive_folder_name,classroom_course_id) VALUES(1,'old-folder','Old folder','keep-classroom');
    INSERT INTO app_settings(key,value) VALUES('google.storage_owner_user_id','1'),('project.storage_user.1','1'),('note.keep','yes');`);
      db.exec(`INSERT INTO google_connections_v2(user_id,google_subject,encrypted_refresh_token,scopes,status,updated_at) VALUES(3,'fake-subject','fake-encrypted','fake-scope','connected',1);
    INSERT INTO classroom_feed_v2(user_id,offering_id,external_id,title) VALUES(3,1,'1:keep','Keep material');
    INSERT INTO local_documents(user_id,name,mime_type,content,size_bytes,created_at,updated_at) VALUES(3,'Local file','text/plain',X'61',1,1,1);
    INSERT INTO storage_backends(kind,name,owner_user_id,root_ref,state) VALUES('google-drive','Central Drive',3,'old-root','ready');`);
      const beforeNotes = legacy.sqlite.prepare("SELECT * FROM notes").all();
      const beforeGoogle = db
        .prepare("SELECT * FROM google_connections_v2")
        .all();
      expect(() =>
        resetDriveLibraryRecords(
          db,
          legacy,
          userActor(3),
          "RESET_DRIVE_LIBRARY",
        ),
      ).toThrow("Admin");
      expect(() =>
        resetDriveLibraryRecords(db, legacy, adminActor(1), "wrong"),
      ).toThrow("confirmação");
      expect(
        resetDriveLibraryRecords(
          db,
          legacy,
          adminActor(1),
          "RESET_DRIVE_LIBRARY",
        ),
      ).toEqual({ projects: 2, documents: 1, templates: 1, localDocuments: 1 });
      expect(legacy.sqlite.prepare("SELECT * FROM notes").all()).toEqual(
        beforeNotes,
      );
      expect(db.prepare("SELECT * FROM google_connections_v2").all()).toEqual(
        beforeGoogle,
      );
      expect(db.prepare("SELECT title FROM classroom_feed_v2").get()).toEqual({
        title: "Keep material",
      });
      expect(
        legacy.sqlite
          .prepare(
            "SELECT drive_folder_id folder,classroom_course_id classroom FROM offering_google_integrations",
          )
          .get(),
      ).toEqual({ folder: null, classroom: "keep-classroom" });
      expect(
        legacy.sqlite
          .prepare(
            "SELECT value FROM app_settings WHERE key='google.storage_owner_user_id'",
          )
          .get(),
      ).toEqual({ value: "1" });
      expect(
        legacy.sqlite
          .prepare("SELECT value FROM app_settings WHERE key='note.keep'")
          .get(),
      ).toEqual({ value: "yes" });
      expect(legacy.sqlite.pragma("foreign_key_check")).toEqual([]);
      expect(db.pragma("foreign_key_check")).toEqual([]);
      expect(
        resetDriveLibraryRecords(
          db,
          legacy,
          adminActor(1),
          "RESET_DRIVE_LIBRARY",
        ),
      ).toEqual({ projects: 0, documents: 0, templates: 0, localDocuments: 0 });
    } finally {
      legacy.close();
      db.close();
    }
  });
});
