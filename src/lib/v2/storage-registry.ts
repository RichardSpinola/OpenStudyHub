import { dirname, join } from "node:path";
import type { V2Database } from "./database";
import { GoogleDriveStorageProvider } from "./drive-storage";
import { v2RuntimePath } from "./runtime";
import { LocalStorageProvider, StorageRegistry } from "./storage";

export function configuredStorageRegistry(
  db: V2Database,
  localRoot = join(dirname(v2RuntimePath()), "local-assets"),
): StorageRegistry {
  const registry = new StorageRegistry();
  const rows = db
    .prepare(
      "SELECT id,kind,name FROM storage_backends WHERE state!='disabled'",
    )
    .all() as Array<{ id: number; kind: string; name: string }>;
  for (const row of rows) {
    if (row.kind === "local")
      registry.register(row.name, new LocalStorageProvider(localRoot));
    if (row.kind === "google-drive") {
      registry.register(row.name, new GoogleDriveStorageProvider(db, row.id));
    }
  }
  return registry;
}
