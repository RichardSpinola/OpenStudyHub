import { getDatabase, type DatabaseConnection } from "@/lib/db/client";

export function searchUsesSameTab(
  userId: number,
  connection: DatabaseConnection = getDatabase(),
): boolean {
  const row = connection.sqlite
    .prepare("SELECT value FROM app_settings WHERE key=?")
    .get(`user.${userId}.search.same_tab`) as { value: string } | undefined;
  return row?.value !== "false";
}
export function saveSearchSameTab(
  userId: number,
  sameTab: boolean,
  connection: DatabaseConnection = getDatabase(),
) {
  connection.sqlite
    .prepare(
      `INSERT INTO app_settings(key,value,updated_at) VALUES(?,?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=excluded.updated_at`,
    )
    .run(`user.${userId}.search.same_tab`, String(sameTab), Date.now());
}
