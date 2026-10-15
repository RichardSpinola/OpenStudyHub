import { getDatabase, type DatabaseConnection } from "./db/client";
export function getDriveAccessPolicy(
  connection: DatabaseConnection = getDatabase(),
): "app-only" | "direct" {
  const row = connection.sqlite
    .prepare(
      "SELECT value FROM app_settings WHERE key='storage.drive_access_policy'",
    )
    .get() as { value: string } | undefined;
  return row?.value === "app-only" ? "app-only" : "direct";
}
