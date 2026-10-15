import { afterEach, describe, it, expect, vi } from "vitest";
import { createMigratedTestDatabase } from "./test-database";
import { createDocumentTemplate } from "./document-templates";
import { openOwnedTemplateSource } from "./template-source-access";
import { verifiedGoogleEmailV2 } from "./v2/google-oauth";
import { grantDriveFileWriter } from "./google/drive";
vi.mock("./google/drive", () => ({
  grantDriveFileWriter: vi.fn(async () => {}),
  exportGoogleDocument: vi.fn(),
}));
vi.mock("./google/oauth", () => ({
  getGoogleAccessToken: vi.fn(async () => "synthetic-token"),
}));
vi.mock("./v2/runtime-database", () => ({
  withV2DbAsync: async (fn: (db: unknown) => unknown) =>
    fn({ prepare: () => ({ get: () => ({ id: 3 }) }) }),
}));
vi.mock("./v2/google-oauth", () => ({
  verifiedGoogleEmailV2: vi.fn(async () => "canonical-owner@example.test"),
}));
afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});
function fixture() {
  vi.stubEnv("OPENSTUDYHUB_V2_ENABLED", "0");
  const c = createMigratedTestDatabase();
  c.sqlite.exec(
    "INSERT INTO users(id,display_name,login,password_hash,role) VALUES(1,'Owner','own','fake','member'),(2,'Other','other','fake','member'),(9,'Storage','storage','fake','member');INSERT INTO google_connections(user_id,google_subject,account_email,encrypted_refresh_token,granted_scopes,status) VALUES(1,'owner-subject','owner@example.test','fake','openid email drive.file','connected')",
  );
  const t = createDocumentTemplate(
    1,
    {
      name: "Modelo",
      sourceFileId: "source-template-file",
      namingPattern: "{{document.title}}",
    },
    c,
    9,
  );
  return { c, t };
}
describe("Owner access to a central template source", () => {
  it("allows the owner to open their private copy, grants only to a verified identity and rejects another app user", async () => {
    const { c, t } = fixture();
    try {
      const fetchImpl = vi.fn(async () =>
        Response.json({
          sub: "owner-subject",
          email: "owner@example.test",
          email_verified: true,
        }),
      ) as typeof fetch;
      await expect(
        openOwnedTemplateSource(2, t.id, { connection: c, fetchImpl }),
      ).rejects.toThrow();
      expect(fetchImpl).not.toHaveBeenCalled();
      expect(
        (await openOwnedTemplateSource(1, t.id, { connection: c, fetchImpl }))
          .kind,
      ).toBe("direct");
      expect(grantDriveFileWriter).toHaveBeenCalledWith(
        9,
        "source-template-file",
        "owner@example.test",
        expect.anything(),
      );
    } finally {
      c.close();
    }
  });
  it("rejects a different Google subject even if it provides an email", async () => {
    const { c, t } = fixture();
    try {
      const fetchImpl = vi.fn(async () =>
        Response.json({
          sub: "different",
          email: "other@example.test",
          email_verified: true,
        }),
      ) as typeof fetch;
      await expect(
        openOwnedTemplateSource(1, t.id, { connection: c, fetchImpl }),
      ).rejects.toThrow("identidade");
      expect(grantDriveFileWriter).not.toHaveBeenCalled();
    } finally {
      c.close();
    }
  });
  it("app-only mode does not grant a Google permission or request a personal token", async () => {
    const { c, t } = fixture();
    try {
      c.sqlite.exec(
        "INSERT INTO app_settings(key,value) VALUES('storage.drive_access_policy','app-only')",
      );
      const fetchImpl = vi.fn() as typeof fetch;
      expect(
        (await openOwnedTemplateSource(1, t.id, { connection: c, fetchImpl }))
          .kind,
      ).toBe("app-only");
      expect(fetchImpl).not.toHaveBeenCalled();
      expect(grantDriveFileWriter).not.toHaveBeenCalled();
    } finally {
      c.close();
    }
  });
  it("uses the canonical Google identity when app and canonical IDs differ", async () => {
    const { c, t } = fixture();
    vi.stubEnv("OPENSTUDYHUB_V2_ENABLED", "1");
    try {
      const fetchImpl = vi.fn() as typeof fetch;
      await openOwnedTemplateSource(1, t.id, { connection: c, fetchImpl });
      expect(verifiedGoogleEmailV2).toHaveBeenCalledWith(expect.anything(), 3, {
        fetchImpl,
      });
      expect(grantDriveFileWriter).toHaveBeenCalledWith(
        9,
        "source-template-file",
        "canonical-owner@example.test",
        expect.anything(),
      );
    } finally {
      c.close();
    }
  });
});
