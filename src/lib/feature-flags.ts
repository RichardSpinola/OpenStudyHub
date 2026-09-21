import { z } from "zod";

import { recordAuditEvent } from "@/lib/audit";
import type { DatabaseConnection } from "@/lib/db/client";
import { getDatabase } from "@/lib/db/client";

const PROJECTS_KEY = "features.projects.enabled";
const idSchema = z.number().int().positive();

export function isProjectsFeatureEnabled(
  connection: DatabaseConnection = getDatabase(),
): boolean {
  const row = connection.sqlite
    .prepare("select value from app_settings where key = ?")
    .get(PROJECTS_KEY) as { value: string } | undefined;
  return row?.value !== "false";
}

export function setProjectsFeatureEnabled(
  actorUserId: number,
  enabled: boolean,
  connection: DatabaseConnection = getDatabase(),
): void {
  const actorId = idSchema.parse(actorUserId);
  const actor = connection.sqlite
    .prepare("select role from users where id = ? and active = 1")
    .get(actorId) as { role: string } | undefined;
  if (actor?.role !== "admin") throw new Error("Admin access required.");
  connection.sqlite
    .prepare(
      `insert into app_settings (key, value, updated_at) values (?, ?, ?)
       on conflict(key) do update set value = excluded.value,
         updated_at = excluded.updated_at`,
    )
    .run(PROJECTS_KEY, enabled ? "true" : "false", Date.now());
  recordAuditEvent(
    {
      actorUserId: actorId,
      action: "settings.feature_projects_update",
      targetType: "app_setting",
      targetId: PROJECTS_KEY,
      summary: enabled
        ? "Projects feature enabled"
        : "Projects feature disabled",
    },
    connection,
  );
}
