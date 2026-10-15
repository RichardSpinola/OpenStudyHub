import { describe, expect, it, vi } from "vitest";
import { createMigratedTestDatabase } from "./test-database";
import { getDriveAccessPolicy } from "./drive-access-policy";
import { downloadGeneratedDocument } from "./document-workflows";
import { exportGoogleDocument } from "./google/drive";
vi.mock("./google/drive", () => ({
  exportGoogleDocument: vi.fn(async () => Buffer.from("%PDF-1.7 test")),
}));
describe("Private document downloads and Drive policy", () => {
  it("preserves old direct mode and allows explicit app-only mode", () => {
    const c = createMigratedTestDatabase();
    try {
      expect(getDriveAccessPolicy(c)).toBe("direct");
      c.sqlite
        .prepare(
          "INSERT INTO app_settings(key,value) VALUES('storage.drive_access_policy','app-only')",
        )
        .run();
      expect(getDriveAccessPolicy(c)).toBe("app-only");
    } finally {
      c.close();
    }
  });
  it("exports with the stored storage identity only for an owner or current authorized group member", async () => {
    const c = createMigratedTestDatabase();
    try {
      c.sqlite.exec(
        "INSERT INTO users(id,display_name,login,password_hash,role) VALUES(1,'Owner','own','fake','member'),(2,'Member','member','fake','member'),(3,'Other','other','fake','member'),(8,'Storage','storage','fake','member'); INSERT INTO programs(id,name) VALUES(1,'Course');INSERT INTO subjects(id,name) VALUES(1,'Subject');INSERT INTO academic_periods(id,label,starts_on,ends_on) VALUES(1,'2030.1','2030-01-01','2030-06-30');INSERT INTO subject_offerings(id,subject_id,program_id,academic_period_id) VALUES(1,1,1,1);INSERT INTO generated_documents(id,owner_user_id,storage_user_id,offering_id,drive_file_id,web_view_link,name) VALUES(1,1,8,1,'private-generated-doc','https://example.test/private','Meu documento');INSERT INTO study_groups(id,name,created_by_user_id) VALUES(1,'Grupo',1);INSERT INTO study_group_members(group_id,user_id,member_role) VALUES(1,1,'owner'),(1,2,'member');INSERT INTO document_group_shares(document_id,group_id,shared_by_user_id) VALUES(1,1,1)",
      );
      await expect(
        downloadGeneratedDocument(3, 1, { connection: c }),
      ).rejects.toThrow("não encontrado");
      expect(exportGoogleDocument).not.toHaveBeenCalled();
      expect(
        (
          await downloadGeneratedDocument(2, 1, { connection: c })
        ).bytes.toString(),
      ).toContain("%PDF");
      expect(exportGoogleDocument).toHaveBeenCalledWith(
        8,
        "private-generated-doc",
        "application/pdf",
        expect.anything(),
      );
      c.sqlite.exec("DELETE FROM study_group_members WHERE user_id=2");
      await expect(
        downloadGeneratedDocument(2, 1, { connection: c }),
      ).rejects.toThrow("não encontrado");
      c.sqlite.exec(
        "INSERT INTO study_group_members(group_id,user_id,member_role) VALUES(1,2,'member');UPDATE study_groups SET archived_at=1 WHERE id=1",
      );
      await expect(
        downloadGeneratedDocument(2, 1, { connection: c }),
      ).rejects.toThrow("não encontrado");
    } finally {
      c.close();
    }
  });
});
