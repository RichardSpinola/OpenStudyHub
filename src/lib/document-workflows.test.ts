import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { DatabaseConnection } from "@/lib/db/client";
import {
  addDocumentTemplateSection,
  createDocumentTemplate,
} from "@/lib/document-templates";
import { createMigratedTestDatabase } from "@/lib/test-database";

import {
  DocumentGenerationError,
  deleteGeneratedDocument,
  generateDocument,
  listOfferingParticipants,
  listUserGeneratedDocuments,
} from "./document-workflows";
import {
  copyDriveFile,
  ensureDriveFolderForUser,
  getDriveFileMetadata,
  trashDriveFile,
} from "./google/drive";
import { mergeGoogleDocument } from "./google/docs";

vi.mock("./google/drive", () => ({
  getDriveFileMetadata: vi.fn(),
  copyDriveFile: vi.fn(),
  ensureDriveFolderForUser: vi.fn(),
  trashDriveFile: vi.fn(),
}));
vi.mock("./google/docs", () => ({ mergeGoogleDocument: vi.fn() }));

function seed(connection: DatabaseConnection) {
  const now = Date.now();
  const userStatement = connection.sqlite.prepare(
    `insert into users
     (display_name, login, password_hash, role, active,
      password_changed_at, created_at, updated_at)
     values (?, ?, 'hash', 'member', 1, ?, ?, ?)`,
  );
  const ownerId = Number(
    userStatement.run("Ada", "ada", now, now, now).lastInsertRowid,
  );
  const colleagueId = Number(
    userStatement.run("Linus", "linus", now, now, now).lastInsertRowid,
  );
  const outsiderId = Number(
    userStatement.run("Grace", "grace", now, now, now).lastInsertRowid,
  );
  const programId = Number(
    connection.sqlite
      .prepare(
        "insert into programs (name, short_name) values ('Computação', 'COMP')",
      )
      .run().lastInsertRowid,
  );
  const subjectId = Number(
    connection.sqlite
      .prepare("insert into subjects (name, code) values ('Algoritmos', 'ALG')")
      .run().lastInsertRowid,
  );
  const periodId = Number(
    connection.sqlite
      .prepare(
        "insert into academic_periods (label, starts_on, ends_on) values ('2030.1', '2030-01-01', '2030-06-30')",
      )
      .run().lastInsertRowid,
  );
  const offeringId = Number(
    connection.sqlite
      .prepare(
        "insert into subject_offerings (subject_id, program_id, academic_period_id) values (?, ?, ?)",
      )
      .run(subjectId, programId, periodId).lastInsertRowid,
  );
  const enrollment = connection.sqlite.prepare(
    "insert into enrollments (user_id, offering_id) values (?, ?)",
  );
  enrollment.run(ownerId, offeringId);
  enrollment.run(colleagueId, offeringId);
  connection.sqlite
    .prepare(
      `insert into offering_google_integrations
       (offering_id, drive_folder_id, drive_folder_name)
       values (?, 'folder-1', 'Algoritmos')`,
    )
    .run(offeringId);
  const activityId = Number(
    connection.sqlite
      .prepare(
        `insert into activities
         (user_id, offering_id, title, description)
         values (?, ?, 'Lista 1', 'Resolva o exercício')`,
      )
      .run(ownerId, offeringId).lastInsertRowid,
  );
  const template = createDocumentTemplate(
    ownerId,
    {
      name: "Atividade",
      sourceFileId: "1AbCdEfGhIjKlMnOpQrStUvWxYz",
      namingPattern:
        "{{subject.code}} - {{document.title}} - {{document.date}}",
      requiredPlaceholders: ["subject.code", "document.title"],
    },
    connection,
  );
  return { ownerId, colleagueId, outsiderId, offeringId, activityId, template };
}

describe("document workflow", () => {
  let connection: DatabaseConnection;

  beforeEach(() => {
    connection = createMigratedTestDatabase();
    vi.clearAllMocks();
    vi.mocked(getDriveFileMetadata).mockResolvedValue({
      id: "template-file",
      name: "Template",
      mimeType: "application/vnd.google-apps.document",
      trashed: false,
    });
    vi.mocked(copyDriveFile).mockResolvedValue({
      id: "generated-file",
      name: "ALG - Trabalho - 2030-02-01",
      mimeType: "application/vnd.google-apps.document",
      modifiedTime: "2030-02-01T12:00:00.000Z",
    });
    vi.mocked(ensureDriveFolderForUser).mockResolvedValue({
      id: "documents-folder",
      name: "Documentos",
      mimeType: "application/vnd.google-apps.folder",
    });
    vi.mocked(mergeGoogleDocument).mockResolvedValue();
    vi.mocked(trashDriveFile).mockResolvedValue();
  });

  afterEach(() => connection.close());

  it("gera com participantes matriculados, pasta explícita e token do proprietário", async () => {
    const { ownerId, colleagueId, offeringId, activityId, template } =
      seed(connection);
    const generated = await generateDocument(
      ownerId,
      {
        templateId: template.id,
        offeringId,
        activityId,
        studentUserIds: [ownerId, colleagueId],
        enabledOptionalSectionIds: [],
        title: "Trabalho",
        topic: "Estruturas",
        date: "2030-02-01",
      },
      { connection, fetchImpl: vi.fn<typeof fetch>() },
    );

    expect(generated).toMatchObject({
      ownerUserId: ownerId,
      name: "ALG - Trabalho - 2030-02-01",
      webViewLink: "https://docs.google.com/document/d/generated-file/edit",
    });
    expect(copyDriveFile).toHaveBeenCalledWith(
      ownerId,
      expect.objectContaining({ parentFolderId: "documents-folder" }),
      expect.objectContaining({ connection }),
    );
    expect(mergeGoogleDocument).toHaveBeenCalledWith(
      ownerId,
      "generated-file",
      expect.arrayContaining([
        { placeholder: "students.names", value: "Ada, Linus" },
        { placeholder: "activity.prompt", value: "Resolva o exercício" },
      ]),
      "",
      expect.objectContaining({ connection }),
    );
    expect(listUserGeneratedDocuments(ownerId, connection)).toHaveLength(1);
  });

  it("usa a categoria escolhida para organizar o arquivo no Drive", async () => {
    const { ownerId, offeringId, template } = seed(connection);

    await generateDocument(
      ownerId,
      {
        templateId: template.id,
        offeringId,
        enabledOptionalSectionIds: [],
        studentUserIds: [],
        title: "Lista",
        categoryKind: "activity",
        date: "2030-02-01",
      },
      { connection, fetchImpl: vi.fn<typeof fetch>() },
    );

    expect(ensureDriveFolderForUser).toHaveBeenCalledWith(
      ownerId,
      {
        name: "Atividades",
        parentId: "folder-1",
        identityKey: `offering:${offeringId}:category:activities`,
      },
      expect.objectContaining({ connection }),
    );
    expect(copyDriveFile).toHaveBeenCalledWith(
      ownerId,
      expect.objectContaining({ parentFolderId: "documents-folder" }),
      expect.objectContaining({ connection }),
    );
  });

  it("trata placeholder opcional ausente como vazio", async () => {
    const { ownerId, offeringId, template } = seed(connection);
    const optionalSection = addDocumentTemplateSection(
      ownerId,
      template.id,
      {
        internalKey: "observations",
        displayTitle: "Observações",
        type: "text",
        optional: true,
        initialSource: "document.topic",
      },
      connection,
    );

    await generateDocument(
      ownerId,
      {
        templateId: template.id,
        offeringId,
        enabledOptionalSectionIds: [optionalSection.id],
        studentUserIds: [],
        title: "Sem tema",
        date: "2030-02-01",
      },
      { connection, fetchImpl: vi.fn<typeof fetch>() },
    );

    expect(mergeGoogleDocument).toHaveBeenCalledWith(
      ownerId,
      "generated-file",
      expect.arrayContaining([
        { placeholder: "document.topic", value: "" },
        { placeholder: "instructor.display_name", value: "" },
      ]),
      "Observações",
      expect.objectContaining({ connection }),
    );
  });

  it("separa proprietário Hub da credencial do Drive central", async () => {
    const { ownerId, offeringId, template } = seed(connection);
    const now = Date.now();
    const storageUserId = Number(
      connection.sqlite
        .prepare(
          `insert into users
           (display_name, login, password_hash, role, active,
            password_changed_at, created_at, updated_at)
           values ('Storage', 'storage', 'hash', 'member', 1, ?, ?, ?)`,
        )
        .run(now, now, now).lastInsertRowid,
    );
    connection.sqlite
      .prepare("update document_templates set storage_user_id = ? where id = ?")
      .run(storageUserId, template.id);
    connection.sqlite
      .prepare(
        "update offering_google_integrations set drive_storage_user_id = ? where offering_id = ?",
      )
      .run(storageUserId, offeringId);

    const generated = await generateDocument(
      ownerId,
      {
        templateId: template.id,
        offeringId,
        enabledOptionalSectionIds: [],
        studentUserIds: [],
        title: "Central",
        date: "2030-02-01",
      },
      { connection, fetchImpl: vi.fn<typeof fetch>() },
    );

    expect(copyDriveFile).toHaveBeenCalledWith(
      storageUserId,
      expect.objectContaining({ parentFolderId: "documents-folder" }),
      expect.objectContaining({ connection }),
    );
    expect(mergeGoogleDocument).toHaveBeenCalledWith(
      storageUserId,
      "generated-file",
      expect.any(Array),
      "",
      expect.objectContaining({ connection }),
    );
    expect(generated).toMatchObject({
      ownerUserId: ownerId,
      storageUserId,
      googlePermissionStatus: "needs_authorization",
    });
  });

  it("recusa geração quando um placeholder obrigatório não possui valor", async () => {
    const { ownerId, offeringId } = seed(connection);
    const template = createDocumentTemplate(
      ownerId,
      {
        name: "Modelo com professor obrigatório",
        sourceFileId: "1RequiredPlaceholderDocument",
        namingPattern: "{{subject.name}} - {{document.title}}",
        requiredPlaceholders: ["instructor.display_name"],
      },
      connection,
    );

    await expect(
      generateDocument(
        ownerId,
        {
          templateId: template.id,
          offeringId,
          enabledOptionalSectionIds: [],
          studentUserIds: [],
          title: "Sem professor",
          date: "2030-02-01",
        },
        { connection },
      ),
    ).rejects.toThrow("Required document context is missing.");
    expect(getDriveFileMetadata).not.toHaveBeenCalled();
    expect(copyDriveFile).not.toHaveBeenCalled();
  });

  it("recusa participante não matriculado e outro usuário antes da rede", async () => {
    const { ownerId, outsiderId, offeringId, template } = seed(connection);
    await expect(
      generateDocument(
        ownerId,
        {
          templateId: template.id,
          offeringId,
          studentUserIds: [outsiderId],
          enabledOptionalSectionIds: [],
          title: "Inválido",
          date: "2030-02-01",
        },
        { connection },
      ),
    ).rejects.toThrow("Invalid document participants.");
    await expect(
      generateDocument(
        outsiderId,
        {
          templateId: template.id,
          offeringId,
          studentUserIds: [],
          enabledOptionalSectionIds: [],
          title: "Inválido",
          date: "2030-02-01",
        },
        { connection },
      ),
    ).rejects.toThrow("Document template not found.");
    expect(getDriveFileMetadata).not.toHaveBeenCalled();
    expect(copyDriveFile).not.toHaveBeenCalled();
  });

  it("envia somente a cópia recém-criada à lixeira quando o merge falha", async () => {
    const { ownerId, offeringId, template } = seed(connection);
    vi.mocked(mergeGoogleDocument).mockRejectedValueOnce(
      new Error("Google Docs merge failed."),
    );
    await expect(
      generateDocument(
        ownerId,
        {
          templateId: template.id,
          offeringId,
          studentUserIds: [],
          enabledOptionalSectionIds: [],
          title: "Falha",
          date: "2030-02-01",
        },
        { connection },
      ),
    ).rejects.toMatchObject({
      name: "DocumentGenerationError",
      code: "docs-unavailable",
    } satisfies Partial<DocumentGenerationError>);
    expect(trashDriveFile).toHaveBeenCalledWith(
      ownerId,
      "generated-file",
      expect.objectContaining({ connection }),
    );
    expect(listUserGeneratedDocuments(ownerId, connection)).toEqual([]);
  });

  it("distingue falta de acesso ao documento-base antes de copiar", async () => {
    const { ownerId, offeringId, template } = seed(connection);
    vi.mocked(getDriveFileMetadata).mockRejectedValueOnce(
      new Error("Drive file lookup failed."),
    );
    await expect(
      generateDocument(
        ownerId,
        {
          templateId: template.id,
          offeringId,
          studentUserIds: [],
          enabledOptionalSectionIds: [],
          title: "Sem acesso",
          date: "2030-02-01",
        },
        { connection },
      ),
    ).rejects.toMatchObject({ code: "template-access" });
    expect(copyDriveFile).not.toHaveBeenCalled();
  });

  it("remove só do Hub sem tocar no arquivo do Drive", async () => {
    const { ownerId, offeringId, template } = seed(connection);
    const generated = await generateDocument(
      ownerId,
      {
        templateId: template.id,
        offeringId,
        studentUserIds: [],
        enabledOptionalSectionIds: [],
        title: "Remover",
        date: "2030-02-01",
      },
      { connection, fetchImpl: vi.fn<typeof fetch>() },
    );

    await deleteGeneratedDocument(ownerId, generated.id, "hub", { connection });

    expect(listUserGeneratedDocuments(ownerId, connection)).toEqual([]);
    expect(trashDriveFile).not.toHaveBeenCalled();
  });

  it("move o arquivo para a lixeira ao excluir também do Drive", async () => {
    const { ownerId, offeringId, template } = seed(connection);
    const generated = await generateDocument(
      ownerId,
      {
        templateId: template.id,
        offeringId,
        studentUserIds: [],
        enabledOptionalSectionIds: [],
        title: "Excluir",
        date: "2030-02-01",
      },
      { connection, fetchImpl: vi.fn<typeof fetch>() },
    );

    await deleteGeneratedDocument(ownerId, generated.id, "drive", {
      connection,
    });

    expect(trashDriveFile).toHaveBeenCalledWith(
      ownerId,
      "generated-file",
      expect.objectContaining({ connection }),
    );
    expect(listUserGeneratedDocuments(ownerId, connection)).toEqual([]);
  });

  it("lista participantes somente após validar a matrícula do solicitante", () => {
    const { ownerId, outsiderId, offeringId } = seed(connection);
    expect(listOfferingParticipants(ownerId, offeringId, connection)).toEqual([
      { id: ownerId, displayName: "Ada" },
      expect.objectContaining({ displayName: "Linus" }),
    ]);
    expect(() =>
      listOfferingParticipants(outsiderId, offeringId, connection),
    ).toThrow("outside the user's academic context");
  });
});
