import { z } from "zod";

import { assertActiveAdmin } from "@/lib/access";
import { recordAuditEvent } from "@/lib/audit";
import type { DatabaseConnection } from "@/lib/db/client";
import { getDatabase } from "@/lib/db/client";

export const INSTITUTION_NAME_SETTING = "institution.display_name";

export const institutionNameSchema = z.string().trim().max(160);

export function getInstitutionName(
  connection: DatabaseConnection = getDatabase(),
): string {
  const row = connection.sqlite
    .prepare("select value from app_settings where key = ?")
    .get(INSTITUTION_NAME_SETTING) as { value: string } | undefined;
  return institutionNameSchema.safeParse(row?.value).data ?? "";
}

export function updateInstitutionName(
  actorUserId: number,
  nameInput: string,
  connection: DatabaseConnection = getDatabase(),
): string {
  const name = institutionNameSchema.parse(nameInput);
  const update = connection.sqlite.transaction(() => {
    assertActiveAdmin(actorUserId, connection);
    const now = Date.now();
    if (name) {
      connection.sqlite
        .prepare(
          `insert into app_settings (key, value, updated_at)
           values (?, ?, ?)
           on conflict(key) do update set
             value = excluded.value,
             updated_at = excluded.updated_at`,
        )
        .run(INSTITUTION_NAME_SETTING, name, now);
    } else {
      connection.sqlite
        .prepare("delete from app_settings where key = ?")
        .run(INSTITUTION_NAME_SETTING);
    }
    recordAuditEvent(
      {
        actorUserId,
        action: "institution.update",
        targetType: "institution",
        targetId: null,
        summary: name
          ? "institution display name updated"
          : "institution display name cleared",
      },
      connection,
    );
  });
  update.immediate();
  return name;
}
