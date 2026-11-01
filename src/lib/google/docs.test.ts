import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { DatabaseConnection } from "@/lib/db/client";
import { createMigratedTestDatabase } from "@/lib/test-database";

import {
  createGoogleTemplateDocument,
  mergeGoogleDocument,
  removeGoogleDocumentSections,
} from "./docs";
import { getGoogleAccessToken } from "./oauth";

vi.mock("./oauth", () => ({
  getGoogleAccessToken: vi.fn(async () => "access-token"),
}));

describe("Google Docs adapter", () => {
  let connection: DatabaseConnection;

  beforeEach(() => {
    connection = createMigratedTestDatabase();
    vi.mocked(getGoogleAccessToken).mockClear();
  });

  afterEach(() => connection.close());

  it("cria base editável com marcador de seções usando o token do proprietário", async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(Response.json({ documentId: "doc-created" }))
      .mockResolvedValueOnce(Response.json({ replies: [{}] }));
    await expect(
      createGoogleTemplateDocument(7, "Modelo", { connection, fetchImpl }),
    ).resolves.toEqual({
      documentId: "doc-created",
      webViewLink: "https://docs.google.com/document/d/doc-created/edit",
    });
    expect(getGoogleAccessToken).toHaveBeenCalledWith(7, {
      connection,
      fetchImpl,
    });
    const body = JSON.parse(String(fetchImpl.mock.calls[1]?.[1]?.body));
    expect(body.requests[0].insertText.text).toContain("{{document.sections}}");
  });

  it("substitui placeholders em lote sem anexar quando o marcador existe", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(
      Response.json({
        replies: [
          { replaceAllText: { occurrencesChanged: 1 } },
          { replaceAllText: { occurrencesChanged: 1 } },
        ],
      }),
    );
    await mergeGoogleDocument(
      9,
      "document-id",
      [
        { placeholder: "subject.name", value: "Algoritmos" },
        { placeholder: "document.sections", value: "Resposta\n" },
      ],
      "Resposta\n",
      { connection, fetchImpl },
    );
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(
      JSON.parse(String(fetchImpl.mock.calls[0]?.[1]?.body)),
    ).toMatchObject({
      requests: [
        {
          replaceAllText: {
            containsText: { text: "{{subject.name}}", matchCase: true },
            replaceText: "Algoritmos",
          },
        },
        {
          replaceAllText: {
            containsText: { text: "{{document.sections}}", matchCase: true },
            replaceText: "Resposta\n",
          },
        },
      ],
    });
  });

  it("anexa as seções quando um template legado não possui o marcador", async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        Response.json({
          replies: [{ replaceAllText: { occurrencesChanged: 0 } }],
        }),
      )
      .mockResolvedValueOnce(
        Response.json({ body: { content: [{ endIndex: 20 }] } }),
      )
      .mockResolvedValueOnce(Response.json({ replies: [{}] }));
    await mergeGoogleDocument(
      9,
      "legacy-document",
      [{ placeholder: "document.sections", value: "Código\n```\n```" }],
      "Código\n```\n```",
      { connection, fetchImpl },
    );
    expect(fetchImpl).toHaveBeenCalledTimes(3);
    const body = JSON.parse(String(fetchImpl.mock.calls[2]?.[1]?.body));
    expect(body.requests[0].insertText).toEqual({
      location: { index: 19 },
      text: "\nCódigo\n```\n```",
    });
  });

  it("apaga título e corpo das seções desmarcadas até o próximo título", async () => {
    const paragraph = (start: number, text: string) => ({
      startIndex: start,
      endIndex: start + text.length,
      paragraph: { elements: [{ textRun: { content: text } }] },
    });
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        Response.json({
          body: {
            content: [
              { endIndex: 1, sectionBreak: {} },
              paragraph(1, "ANOTAÇÕES:\n"),
              paragraph(12, "texto\n"),
              paragraph(18, "RESUMO:\n"),
              paragraph(26, "[resuma]\n"),
              paragraph(35, "\n"),
              paragraph(36, "DÚVIDAS:\n"),
              paragraph(45, "[anote]\n"),
            ],
          },
        }),
      )
      .mockResolvedValueOnce(Response.json({ replies: [{}, {}] }));

    await expect(
      removeGoogleDocumentSections(
        9,
        "document-id",
        ["Resumo", "Dúvidas"],
        ["Anotações", "Resumo", "Dúvidas"],
        { connection, fetchImpl },
      ),
    ).resolves.toBe(2);

    const body = JSON.parse(String(fetchImpl.mock.calls[1]?.[1]?.body));
    expect(body.requests).toEqual([
      { deleteContentRange: { range: { startIndex: 36, endIndex: 52 } } },
      { deleteContentRange: { range: { startIndex: 18, endIndex: 36 } } },
    ]);
  });

  it("não chama o Google quando nenhuma seção foi desmarcada", async () => {
    const fetchImpl = vi.fn<typeof fetch>();
    await expect(
      removeGoogleDocumentSections(9, "document-id", [], ["Resumo"], {
        connection,
        fetchImpl,
      }),
    ).resolves.toBe(0);
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
