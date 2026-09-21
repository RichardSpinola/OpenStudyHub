import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { DatabaseConnection } from "@/lib/db/client";
import { getUserDocumentTemplate } from "@/lib/document-templates";
import { createMigratedTestDatabase } from "@/lib/test-database";
import { parseServerEnvironment } from "@/lib/env";

import {
  importStarterDocumentTemplate,
  starterDocumentTemplates,
} from "./starter-document-templates";
import {
  copyDriveFile,
  ensureDriveFolderForUser,
  ensureDriveRootFolder,
  trashDriveFile,
} from "./google/drive";

vi.mock("./google/drive", () => ({
  copyDriveFile: vi.fn(),
  ensureDriveFolderForUser: vi.fn(),
  ensureDriveRootFolder: vi.fn(),
  trashDriveFile: vi.fn(),
}));

const environment = parseServerEnvironment({
  NODE_ENV: "test",
  GOOGLE_TEMPLATE_GENERIC_ACTIVITY_ID: "base-generic",
  GOOGLE_TEMPLATE_PROGRAMMING_ACTIVITY_ID: "base-programming",
  GOOGLE_TEMPLATE_CLASS_NOTES_ID: "base-notes",
});

function createUser(connection: DatabaseConnection): number {
  const now = Date.now();
  return Number(
    connection.sqlite
      .prepare(
        `insert into users
         (display_name, login, password_hash, role, active,
          password_changed_at, created_at, updated_at)
         values ('Pessoa', 'pessoa', 'hash', 'member', 1, ?, ?, ?)`,
      )
      .run(now, now, now).lastInsertRowid,
  );
}

describe("starter document templates", () => {
  let connection: DatabaseConnection;

  beforeEach(() => {
    connection = createMigratedTestDatabase();
    vi.clearAllMocks();
    vi.mocked(ensureDriveRootFolder).mockResolvedValue({
      id: "drive-root",
      name: "OpenStudyHub",
      mimeType: "application/vnd.google-apps.folder",
    });
    vi.mocked(copyDriveFile).mockResolvedValue({
      id: "imported-doc",
      name: "Atividade",
      mimeType: "application/vnd.google-apps.document",
    });
    vi.mocked(ensureDriveFolderForUser).mockResolvedValue({
      id: "templates-folder",
      name: "_Templates",
      mimeType: "application/vnd.google-apps.folder",
    });
    vi.mocked(trashDriveFile).mockResolvedValue();
  });

  afterEach(() => connection.close());

  it("mantém exatamente três exemplos genéricos na allowlist", () => {
    expect(starterDocumentTemplates.map(({ key }) => key)).toEqual([
      "generic_activity",
      "programming_activity",
      "class_notes",
    ]);
    expect(JSON.stringify(starterDocumentTemplates)).not.toMatch(
      /UCSAL|@(?:gmail|hotmail|outlook)|871688|819906/iu,
    );
  });

  it("recusa uma chave fora da allowlist antes de chamar o Google", async () => {
    const userId = createUser(connection);
    await expect(
      importStarterDocumentTemplate(userId, "../../.env", {
        connection,
        environment,
      }),
    ).rejects.toThrow();
    expect(copyDriveFile).not.toHaveBeenCalled();
  });

  it("cria um Google Doc funcional e a configuração pessoal com seções", async () => {
    const userId = createUser(connection);
    const templateId = await importStarterDocumentTemplate(
      userId,
      "programming_activity",
      { connection, environment },
    );
    const template = getUserDocumentTemplate(userId, templateId, connection);
    expect(template).toMatchObject({
      sourceFileId: "imported-doc",
      name: "Atividade de programação",
    });
    expect(template.sections.map(({ internalKey }) => internalKey)).toEqual([
      "question",
      "answer",
      "code",
      "result",
    ]);
    expect(copyDriveFile).toHaveBeenCalledWith(
      userId,
      {
        sourceFileId: "base-programming",
        name: "Atividade de programação — OpenStudyHub",
        parentFolderId: "templates-folder",
      },
      expect.objectContaining({ connection }),
    );
    expect(trashDriveFile).not.toHaveBeenCalled();
  });
});
