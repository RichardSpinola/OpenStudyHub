import { z } from "zod";

import type { DatabaseConnection } from "@/lib/db/client";
import { getDatabase } from "@/lib/db/client";

import { getGoogleAccessToken, type GoogleFetch } from "./oauth";

const DOCS_ENDPOINT = "https://docs.googleapis.com/v1/documents";
const idSchema = z.number().int().positive();
const documentIdSchema = z.string().trim().min(1).max(255);

async function docsRequest(
  accessToken: string,
  url: string,
  init: RequestInit,
  fetchImpl: GoogleFetch,
): Promise<Response> {
  return fetchImpl(url, {
    ...init,
    headers: {
      authorization: `Bearer ${accessToken}`,
      ...(init.body ? { "content-type": "application/json" } : {}),
      ...init.headers,
    },
    signal: AbortSignal.timeout(15_000),
  });
}

export async function createGoogleTemplateDocument(
  userId: number,
  title: string,
  options: {
    connection?: DatabaseConnection;
    fetchImpl?: GoogleFetch;
  } = {},
) {
  const ownerId = idSchema.parse(userId);
  const safeTitle = z.string().trim().min(1).max(255).parse(title);
  const connection = options.connection ?? getDatabase();
  const fetchImpl = options.fetchImpl ?? fetch;
  const accessToken = await getGoogleAccessToken(ownerId, {
    connection,
    fetchImpl,
  });
  const createResponse = await docsRequest(
    accessToken,
    DOCS_ENDPOINT,
    { method: "POST", body: JSON.stringify({ title: safeTitle }) },
    fetchImpl,
  );
  if (!createResponse.ok) throw new Error("Google Docs creation failed.");
  const created = z
    .object({ documentId: documentIdSchema })
    .parse(await createResponse.json());
  const starter = [
    "{{subject.name}}",
    "{{program.short_name}} — {{period.label}}",
    "{{students.names}}",
    "{{document.date}}",
    "",
    "{{document.sections}}",
  ].join("\n");
  const initializeResponse = await docsRequest(
    accessToken,
    `${DOCS_ENDPOINT}/${encodeURIComponent(created.documentId)}:batchUpdate`,
    {
      method: "POST",
      body: JSON.stringify({
        requests: [{ insertText: { location: { index: 1 }, text: starter } }],
      }),
    },
    fetchImpl,
  );
  if (!initializeResponse.ok) {
    throw new Error("Google Docs template initialization failed.");
  }
  return {
    documentId: created.documentId,
    webViewLink: `https://docs.google.com/document/d/${created.documentId}/edit`,
  };
}

type Replacement = { placeholder: string; value: string };

export async function mergeGoogleDocument(
  userId: number,
  documentId: string,
  replacements: Replacement[],
  sectionFallback: string,
  options: {
    connection?: DatabaseConnection;
    fetchImpl?: GoogleFetch;
  } = {},
): Promise<void> {
  const ownerId = idSchema.parse(userId);
  const safeDocumentId = documentIdSchema.parse(documentId);
  const safeReplacements = z
    .array(
      z.object({
        placeholder: z.string().min(1).max(120),
        value: z.string().max(100_000),
      }),
    )
    .max(100)
    .parse(replacements);
  const connection = options.connection ?? getDatabase();
  const fetchImpl = options.fetchImpl ?? fetch;
  const accessToken = await getGoogleAccessToken(ownerId, {
    connection,
    fetchImpl,
  });
  const requests = safeReplacements.map(({ placeholder, value }) => ({
    replaceAllText: {
      containsText: { text: `{{${placeholder}}}`, matchCase: true },
      replaceText: value,
    },
  }));
  const sectionIndex = safeReplacements.findIndex(
    ({ placeholder }) => placeholder === "document.sections",
  );
  const response = await docsRequest(
    accessToken,
    `${DOCS_ENDPOINT}/${encodeURIComponent(safeDocumentId)}:batchUpdate`,
    { method: "POST", body: JSON.stringify({ requests }) },
    fetchImpl,
  );
  if (!response.ok) throw new Error("Google Docs merge failed.");
  const result = z
    .object({
      replies: z
        .array(
          z.object({
            replaceAllText: z
              .object({ occurrencesChanged: z.number().optional() })
              .optional(),
          }),
        )
        .optional(),
    })
    .parse(await response.json());
  const sectionWasReplaced =
    sectionIndex >= 0 &&
    (result.replies?.[sectionIndex]?.replaceAllText?.occurrencesChanged ?? 0) >
      0;
  if (sectionWasReplaced || !sectionFallback) return;

  const readResponse = await docsRequest(
    accessToken,
    `${DOCS_ENDPOINT}/${encodeURIComponent(safeDocumentId)}`,
    { method: "GET" },
    fetchImpl,
  );
  if (!readResponse.ok) throw new Error("Google Docs structure lookup failed.");
  const document = z
    .object({
      body: z.object({
        content: z.array(z.object({ endIndex: z.number().optional() })),
      }),
    })
    .parse(await readResponse.json());
  const endIndex = Math.max(
    1,
    ...document.body.content.map(({ endIndex }) => endIndex ?? 1),
  );
  const appendResponse = await docsRequest(
    accessToken,
    `${DOCS_ENDPOINT}/${encodeURIComponent(safeDocumentId)}:batchUpdate`,
    {
      method: "POST",
      body: JSON.stringify({
        requests: [
          {
            insertText: {
              location: { index: Math.max(1, endIndex - 1) },
              text: `\n${sectionFallback}`,
            },
          },
        ],
      }),
    },
    fetchImpl,
  );
  if (!appendResponse.ok) throw new Error("Google Docs section append failed.");
}

function headingKey(text: string): string {
  return text
    .normalize("NFC")
    .trim()
    .replace(/:$/u, "")
    .trim()
    .toLocaleUpperCase("pt-BR");
}

function looksLikeHeading(text: string): boolean {
  const trimmed = text.trim();
  return (
    trimmed.endsWith(":") &&
    trimmed.length <= 80 &&
    trimmed === trimmed.toLocaleUpperCase("pt-BR") &&
    /\p{L}/u.test(trimmed)
  );
}

/**
 * Deletes sections written directly in the source document (a heading
 * paragraph such as "RESUMO:" plus its body) when the person unchecked them.
 * A section ends at the next known or all-caps heading, or at the end.
 */
export async function removeGoogleDocumentSections(
  userId: number,
  documentId: string,
  removedTitles: string[],
  allTitles: string[],
  options: {
    connection?: DatabaseConnection;
    fetchImpl?: GoogleFetch;
  } = {},
): Promise<number> {
  const removed = new Set(removedTitles.map(headingKey).filter(Boolean));
  if (!removed.size) return 0;
  const known = new Set(allTitles.map(headingKey).filter(Boolean));
  const ownerId = idSchema.parse(userId);
  const safeDocumentId = documentIdSchema.parse(documentId);
  const connection = options.connection ?? getDatabase();
  const fetchImpl = options.fetchImpl ?? fetch;
  const accessToken = await getGoogleAccessToken(ownerId, {
    connection,
    fetchImpl,
  });
  const readResponse = await docsRequest(
    accessToken,
    `${DOCS_ENDPOINT}/${encodeURIComponent(safeDocumentId)}`,
    { method: "GET" },
    fetchImpl,
  );
  if (!readResponse.ok) throw new Error("Google Docs structure lookup failed.");
  const document = z
    .object({
      body: z.object({
        content: z.array(
          z.object({
            startIndex: z.number().optional(),
            endIndex: z.number().optional(),
            paragraph: z
              .object({
                elements: z
                  .array(
                    z.object({
                      textRun: z
                        .object({ content: z.string().optional() })
                        .optional(),
                    }),
                  )
                  .optional(),
              })
              .optional(),
          }),
        ),
      }),
    })
    .parse(await readResponse.json());
  const blocks = document.body.content.map((block) => ({
    start: block.startIndex ?? 0,
    end: block.endIndex ?? 0,
    text: block.paragraph
      ? (block.paragraph.elements ?? [])
          .map(({ textRun }) => textRun?.content ?? "")
          .join("")
      : null,
  }));
  const documentEnd = Math.max(1, ...blocks.map(({ end }) => end));
  const ranges: Array<{ startIndex: number; endIndex: number }> = [];
  for (let index = 0; index < blocks.length; index += 1) {
    const block = blocks[index]!;
    if (block.text === null || !removed.has(headingKey(block.text))) continue;
    let stop = documentEnd - 1;
    for (let next = index + 1; next < blocks.length; next += 1) {
      const text = blocks[next]!.text;
      if (
        text !== null &&
        (known.has(headingKey(text)) || looksLikeHeading(text))
      ) {
        stop = blocks[next]!.start;
        break;
      }
    }
    if (stop > block.start)
      ranges.push({ startIndex: block.start, endIndex: stop });
  }
  if (!ranges.length) return 0;
  const response = await docsRequest(
    accessToken,
    `${DOCS_ENDPOINT}/${encodeURIComponent(safeDocumentId)}:batchUpdate`,
    {
      method: "POST",
      body: JSON.stringify({
        requests: ranges
          .sort((a, b) => b.startIndex - a.startIndex)
          .map((range) => ({ deleteContentRange: { range } })),
      }),
    },
    fetchImpl,
  );
  if (!response.ok) throw new Error("Google Docs section removal failed.");
  return ranges.length;
}
