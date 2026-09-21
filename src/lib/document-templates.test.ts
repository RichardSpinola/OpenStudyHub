import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { DatabaseConnection } from "@/lib/db/client";
import { createMigratedTestDatabase } from "@/lib/test-database";

import {
  addDocumentTemplateSection,
  cloneDocumentTemplate,
  createDocumentTemplate,
  deleteDocumentTemplateSection,
  getUserDocumentTemplate,
  moveDocumentTemplateSection,
  parseGoogleDocumentId,
  updateDocumentTemplateSection,
} from "./document-templates";

function createUser(connection: DatabaseConnection, login: string) {
  const now = Date.now();
  return Number(
    connection.sqlite
      .prepare(
        `insert into users
         (display_name, login, password_hash, role, active,
          password_changed_at, created_at, updated_at)
         values (?, ?, 'hash', 'member', 1, ?, ?, ?)`,
      )
      .run(login, login, now, now, now).lastInsertRowid,
  );
}

describe("document templates", () => {
  let connection: DatabaseConnection;

  beforeEach(() => {
    connection = createMigratedTestDatabase();
  });

  afterEach(() => connection.close());

  it("aceita ID ou URL exata do Google Docs e recusa hosts enganadores", () => {
    const id = "1AbCdEfGhIjKlMnOpQrStUvWxYz";
    expect(parseGoogleDocumentId(id)).toBe(id);
    expect(
      parseGoogleDocumentId(`https://docs.google.com/document/d/${id}/edit`),
    ).toBe(id);
    expect(() =>
      parseGoogleDocumentId(
        `https://docs.google.com.example.test/document/d/${id}/edit`,
      ),
    ).toThrow("Invalid Google document reference.");
    expect(() => parseGoogleDocumentId("javascript:alert(1)")).toThrow();
  });

  it("clona configuração e permite adicionar, renomear, reordenar e remover seções", () => {
    const ownerId = createUser(connection, "owner");
    const template = createDocumentTemplate(
      ownerId,
      {
        name: "Atividade",
        description: "Modelo genérico",
        categoryKind: "activity",
        sourceFileId: "1AbCdEfGhIjKlMnOpQrStUvWxYz",
        namingPattern: "{{subject.name}} - {{document.title}}",
        requiredPlaceholders: ["subject.name", "document.title"],
        active: true,
      },
      connection,
    );
    const answer = addDocumentTemplateSection(
      ownerId,
      template.id,
      {
        internalKey: "answer",
        displayTitle: "Resposta",
        type: "text",
        optional: false,
        initialSource: null,
        helperText: "Escreva aqui.",
      },
      connection,
    );
    const code = addDocumentTemplateSection(
      ownerId,
      template.id,
      {
        internalKey: "code",
        displayTitle: "Código",
        type: "code",
        optional: true,
        initialSource: null,
        helperText: "// código",
      },
      connection,
    );

    moveDocumentTemplateSection(
      ownerId,
      template.id,
      code.id,
      "up",
      connection,
    );
    updateDocumentTemplateSection(
      ownerId,
      template.id,
      answer.id,
      {
        internalKey: "answer",
        displayTitle: "Resposta final",
        type: "text_or_image",
        optional: false,
        initialSource: null,
        helperText: "Texto ou imagem.",
      },
      connection,
    );
    const configured = getUserDocumentTemplate(
      ownerId,
      template.id,
      connection,
    );
    expect(configured.sections.map(({ internalKey }) => internalKey)).toEqual([
      "code",
      "answer",
    ]);
    expect(configured.sections[1]).toMatchObject({
      displayTitle: "Resposta final",
      type: "text_or_image",
    });

    const clone = cloneDocumentTemplate(
      ownerId,
      template.id,
      "Atividade adaptada",
      connection,
    );
    expect(clone.baseTemplateId).toBe(template.id);
    expect(clone.categoryKind).toBe("activity");
    expect(clone.sections).toHaveLength(2);
    deleteDocumentTemplateSection(
      ownerId,
      clone.id,
      clone.sections[0].id,
      connection,
    );
    expect(
      getUserDocumentTemplate(ownerId, clone.id, connection).sections,
    ).toHaveLength(1);
    expect(
      getUserDocumentTemplate(ownerId, template.id, connection).sections,
    ).toHaveLength(2);
  });

  it("impede acesso cruzado e placeholders desconhecidos", () => {
    const ownerId = createUser(connection, "owner-2");
    const otherId = createUser(connection, "other-2");
    const template = createDocumentTemplate(
      ownerId,
      {
        name: "Notas",
        sourceFileId: "1AbCdEfGhIjKlMnOpQrStUvWxYz",
        namingPattern: "{{subject.name}} - {{document.date}}",
      },
      connection,
    );
    expect(() =>
      getUserDocumentTemplate(otherId, template.id, connection),
    ).toThrow("Document template not found.");
    expect(() =>
      createDocumentTemplate(
        ownerId,
        {
          name: "Inválido",
          sourceFileId: "1AbCdEfGhIjKlMnOpQrStUvWxYz",
          namingPattern: "{{private.secret}}",
        },
        connection,
      ),
    ).toThrow("Unknown document placeholder.");
  });
});
