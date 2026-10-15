import { describe, expect, it, vi } from "vitest";
import { createMigratedTestDatabase } from "./test-database";
import { createProjectZip } from "./project-archive";
import { copyGoogleTemplateSource } from "./google-template-import";
import { validateDocumentTemplateSource } from "./document-workflows";
import {
  copyDriveFile,
  exportGoogleDocumentAsDocx,
  uploadDriveFile,
  trashDriveFile,
  getDriveFileMetadata,
} from "./google/drive";
vi.mock("./document-workflows", () => ({
  validateDocumentTemplateSource: vi.fn(async () => {}),
}));
vi.mock("./google/storage-owner", () => ({
  resolveDriveStorageUser: vi.fn(() => 9),
}));
vi.mock("./google/drive", () => ({
  ensureDriveRootFolder: vi.fn(async () => ({ id: "root" })),
  ensureDriveFolderForUser: vi.fn(async (_id, input) => ({
    id: input.identityKey,
  })),
  copyDriveFile: vi.fn(async () => ({ id: "same-account-copy" })),
  exportGoogleDocumentAsDocx: vi.fn(),
  uploadDriveFile: vi.fn(async () => ({ id: "central-copy" })),
  getDriveFileMetadata: vi.fn(async () => ({
    id: "central-copy",
    mimeType: "application/vnd.google-apps.document",
  })),
  trashDriveFile: vi.fn(async () => {}),
}));
describe("Google Docs template import identities", () => {
  it("reads the personal source with its owner and imports a new document into central storage without mutating the original", async () => {
    const connection = createMigratedTestDatabase();
    try {
      const data = await createProjectZip([
        { path: "[Content_Types].xml", data: Buffer.from("<Types/>") },
        { path: "word/document.xml", data: Buffer.from("<document/>") },
      ]);
      vi.mocked(exportGoogleDocumentAsDocx).mockResolvedValueOnce(
        Buffer.from(data),
      );
      const result = await copyGoogleTemplateSource(
        3,
        "original-personal-doc",
        "Meu modelo",
        { connection },
      );
      expect(validateDocumentTemplateSource).toHaveBeenCalledWith(
        3,
        "original-personal-doc",
        expect.anything(),
      );
      expect(exportGoogleDocumentAsDocx).toHaveBeenCalledWith(
        3,
        "original-personal-doc",
        expect.anything(),
      );
      expect(uploadDriveFile).toHaveBeenCalledWith(
        9,
        expect.objectContaining({
          data,
          targetMimeType: "application/vnd.google-apps.document",
        }),
        expect.anything(),
      );
      expect(result).toEqual({
        sourceFileId: "central-copy",
        storageUserId: 9,
      });
      expect(copyDriveFile).not.toHaveBeenCalled();
      expect(trashDriveFile).not.toHaveBeenCalled();
    } finally {
      connection.close();
    }
  });
  it("copies within one identity and only cleans up a failed new copy", async () => {
    const connection = createMigratedTestDatabase();
    try {
      vi.mocked(getDriveFileMetadata).mockResolvedValueOnce({
        id: "same-account-copy",
        name: "bad",
        mimeType: "text/plain",
      });
      await expect(
        copyGoogleTemplateSource(3, "original-personal-doc", "Meu modelo", {
          connection,
          storageUserId: 3,
        }),
      ).rejects.toThrow("válido");
      expect(copyDriveFile).toHaveBeenCalledWith(
        3,
        expect.objectContaining({ sourceFileId: "original-personal-doc" }),
        expect.anything(),
      );
      expect(trashDriveFile).toHaveBeenCalledWith(
        3,
        "same-account-copy",
        expect.anything(),
      );
    } finally {
      connection.close();
    }
  });
});
