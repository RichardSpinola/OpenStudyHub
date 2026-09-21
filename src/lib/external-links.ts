import { randomUUID } from "node:crypto";

import { z } from "zod";

import { assertActiveAdmin } from "@/lib/access";
import { recordAuditEvent } from "@/lib/audit";
import type { DatabaseConnection } from "@/lib/db/client";
import { getDatabase } from "@/lib/db/client";
import { parseExternalDocumentationUrl } from "@/lib/external-documentation";

const KEY = "links.external";
const LEGACY_DOCUMENTATION_KEY = "documentation.external_url";

const externalLinkSchema = z.object({
  id: z.string().uuid(),
  label: z.string().trim().min(1).max(80),
  url: z.string().max(2048),
  newTab: z.boolean().default(true),
});

const externalLinksSchema = z.array(externalLinkSchema).max(20);

export type ExternalLink = z.infer<typeof externalLinkSchema>;

function parseUrl(value: string): string {
  return parseExternalDocumentationUrl(value);
}

function readStoredLinks(
  connection: DatabaseConnection,
): ExternalLink[] | null {
  const row = connection.sqlite
    .prepare("select value from app_settings where key = ?")
    .get(KEY) as { value: string } | undefined;
  if (!row) return null;
  try {
    return externalLinksSchema.parse(JSON.parse(row.value));
  } catch {
    return [];
  }
}

function readLegacyDocumentation(
  connection: DatabaseConnection,
): ExternalLink[] {
  const row = connection.sqlite
    .prepare("select value from app_settings where key = ?")
    .get(LEGACY_DOCUMENTATION_KEY) as { value: string } | undefined;
  if (!row?.value) return [];
  try {
    const url = parseUrl(row.value);
    return url
      ? [
          {
            id: "00000000-0000-4000-8000-000000000001",
            label: "Documentação",
            url,
            newTab: true,
          },
        ]
      : [];
  } catch {
    return [];
  }
}

export function listExternalLinks(
  connection: DatabaseConnection = getDatabase(),
): ExternalLink[] {
  return readStoredLinks(connection) ?? readLegacyDocumentation(connection);
}

function writeLinks(
  links: ExternalLink[],
  connection: DatabaseConnection,
): void {
  connection.sqlite
    .prepare(
      `insert into app_settings (key, value, updated_at) values (?, ?, ?)
       on conflict(key) do update set value = excluded.value, updated_at = excluded.updated_at`,
    )
    .run(KEY, JSON.stringify(externalLinksSchema.parse(links)), Date.now());
}

export function addExternalLink(
  actorUserId: number,
  input: { label: string; url: string; newTab?: boolean },
  connection: DatabaseConnection = getDatabase(),
): ExternalLink {
  assertActiveAdmin(actorUserId, connection);
  const next = externalLinkSchema.parse({
    id: randomUUID(),
    label: input.label,
    url: parseUrl(input.url),
    newTab: input.newTab ?? true,
  });
  if (!next.url) throw new Error("Link externo inválido.");
  const links = listExternalLinks(connection);
  if (links.length >= 20) throw new Error("Limite de links externos atingido.");
  writeLinks([...links, next], connection);
  recordAuditEvent(
    {
      actorUserId,
      action: "settings.external_link_create",
      targetType: "app_setting",
      targetId: KEY,
      summary: `external link created: ${next.label}`,
    },
    connection,
  );
  return next;
}

export function deleteExternalLink(
  actorUserId: number,
  linkId: string,
  connection: DatabaseConnection = getDatabase(),
): void {
  assertActiveAdmin(actorUserId, connection);
  const id = z.string().uuid().parse(linkId);
  const links = listExternalLinks(connection);
  const next = links.filter((link) => link.id !== id);
  if (next.length === links.length)
    throw new Error("Link externo não encontrado.");
  writeLinks(next, connection);
  recordAuditEvent(
    {
      actorUserId,
      action: "settings.external_link_delete",
      targetType: "app_setting",
      targetId: KEY,
      summary: "external link deleted",
    },
    connection,
  );
}
