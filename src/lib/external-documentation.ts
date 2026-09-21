import { z } from "zod";

import { assertActiveAdmin } from "@/lib/access";
import { recordAuditEvent } from "@/lib/audit";
import type { DatabaseConnection } from "@/lib/db/client";
import { getDatabase } from "@/lib/db/client";
import { getServerEnvironment } from "@/lib/env";

const KEY = "documentation.external_url";

export function parseExternalDocumentationUrl(value: string): string {
  const input = z.string().trim().max(2048).parse(value);
  if (!input) return "";
  const url = new URL(input);
  const environment = getServerEnvironment();
  const developmentLocalhost =
    environment.NODE_ENV !== "production" &&
    url.protocol === "http:" &&
    ["localhost", "127.0.0.1", "::1"].includes(url.hostname);
  if (url.protocol !== "https:" && !developmentLocalhost) {
    throw new Error("Documentation URL must use HTTPS.");
  }
  url.username = "";
  url.password = "";
  return url.toString();
}

export function getExternalDocumentationUrl(
  connection: DatabaseConnection = getDatabase(),
): string {
  const row = connection.sqlite
    .prepare("select value from app_settings where key = ?")
    .get(KEY) as { value: string } | undefined;
  try {
    return row ? parseExternalDocumentationUrl(row.value) : "";
  } catch {
    return "";
  }
}

export function updateExternalDocumentationUrl(
  actorUserId: number,
  input: string,
  connection: DatabaseConnection = getDatabase(),
): string {
  assertActiveAdmin(actorUserId, connection);
  const value = parseExternalDocumentationUrl(input);
  if (value) {
    connection.sqlite
      .prepare(
        `insert into app_settings (key, value, updated_at) values (?, ?, ?)
         on conflict(key) do update set value = excluded.value, updated_at = excluded.updated_at`,
      )
      .run(KEY, value, Date.now());
  } else {
    connection.sqlite
      .prepare("delete from app_settings where key = ?")
      .run(KEY);
  }
  recordAuditEvent(
    {
      actorUserId,
      action: "settings.documentation_url_update",
      targetType: "app_setting",
      targetId: KEY,
      summary: value
        ? "external documentation URL updated"
        : "external documentation URL cleared",
    },
    connection,
  );
  return value;
}
