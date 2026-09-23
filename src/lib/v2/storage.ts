import { createHash, randomUUID } from "node:crypto";
import {
  mkdirSync,
  readFileSync,
  readdirSync,
  realpathSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { isAbsolute, join, resolve } from "node:path";
import type { V2Database } from "./database";

export type StoredObject = {
  key: string;
  providerRef: string;
  size: number;
  sha256: string;
};
export interface StorageProvider {
  readonly kind: "local" | "google-drive";
  put(bytes: Uint8Array): StoredObject;
  get(providerRef: string): Uint8Array;
  delete(providerRef: string): void;
  health(): "ready" | "degraded";
}

function safeKey(key: string): string {
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(key)
  )
    throw new Error("Invalid storage key");
  return key;
}

export class LocalStorageProvider implements StorageProvider {
  readonly kind = "local";
  readonly root: string;
  constructor(root: string) {
    if (!isAbsolute(root)) throw new Error("Storage root must be absolute");
    mkdirSync(root, { recursive: true });
    const canonical = realpathSync(root);
    if (canonical !== resolve(root))
      throw new Error("Symlinked storage root refused");
    this.root = canonical;
  }
  private path(key: string): string {
    return join(this.root, safeKey(key));
  }
  put(bytes: Uint8Array): StoredObject {
    const key = randomUUID();
    const path = this.path(key);
    writeFileSync(path, bytes, { flag: "wx", mode: 0o600 });
    return {
      key,
      providerRef: key,
      size: bytes.length,
      sha256: createHash("sha256").update(bytes).digest("hex"),
    };
  }
  get(providerRef: string): Uint8Array {
    const path = this.path(providerRef);
    if (!statSync(path, { throwIfNoEntry: false }))
      throw new Error("Stored object missing");
    if (realpathSync(path) !== path)
      throw new Error("Symlinked object refused");
    return readFileSync(path);
  }
  delete(providerRef: string): void {
    const path = this.path(providerRef);
    if (statSync(path, { throwIfNoEntry: false })) {
      if (realpathSync(path) !== path)
        throw new Error("Symlinked object refused");
      unlinkSync(path);
    }
  }
  health(): "ready" | "degraded" {
    try {
      readdirSync(this.root);
      return "ready";
    } catch {
      return "degraded";
    }
  }
}

export class StorageRegistry {
  private providers = new Map<string, StorageProvider>();
  register(name: string, provider: StorageProvider): void {
    if (this.providers.has(name)) throw new Error("Duplicate storage backend");
    this.providers.set(name, provider);
  }
  get(name: string): StorageProvider {
    const provider = this.providers.get(name);
    if (!provider) throw new Error("Storage provider unavailable");
    return provider;
  }
}

export function storeObject(
  db: V2Database,
  registry: StorageRegistry,
  backendName: string,
  bytes: Uint8Array,
): number {
  const backend = db
    .prepare(
      "SELECT id,kind FROM storage_backends WHERE name=? AND state='ready'",
    )
    .get(backendName) as { id: number; kind: string } | undefined;
  if (!backend) throw new Error("Storage backend unavailable");
  const provider = registry.get(backendName);
  if (provider.kind !== backend.kind)
    throw new Error("Storage provider mismatch");
  const object = provider.put(bytes);
  try {
    const result = db
      .prepare(
        "INSERT INTO storage_objects(backend_id,object_key,provider_ref,size_bytes,sha256) VALUES(?,?,?,?,?)",
      )
      .run(
        backend.id,
        object.key,
        object.providerRef,
        object.size,
        object.sha256,
      );
    return Number(result.lastInsertRowid);
  } catch (error) {
    provider.delete(object.providerRef);
    throw error;
  }
}

export function readObject(
  db: V2Database,
  registry: StorageRegistry,
  id: number,
): Uint8Array {
  const row = db
    .prepare(
      `SELECT b.name,b.kind,o.provider_ref ref,o.sha256 hash FROM storage_objects o JOIN storage_backends b ON b.id=o.backend_id WHERE o.id=? AND o.archived_at IS NULL`,
    )
    .get(id) as
    { name: string; kind: string; ref: string; hash: string } | undefined;
  if (!row) throw new Error("Stored object missing");
  const provider = registry.get(row.name);
  if (provider.kind !== row.kind) throw new Error("Storage provider mismatch");
  const bytes = provider.get(row.ref);
  if (createHash("sha256").update(bytes).digest("hex") !== row.hash)
    throw new Error("Stored object checksum mismatch");
  return bytes;
}
