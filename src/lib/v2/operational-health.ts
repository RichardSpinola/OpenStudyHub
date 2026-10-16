import { accessSync, constants, existsSync, statfsSync } from "node:fs";
import { dirname } from "node:path";
import { getDatabase } from "../db/client";
import { getServerEnvironment } from "../env";
import { withV2Db } from "./runtime-database";
import { backupMaintenanceActive } from "./maintenance";
import type { V2Database } from "./database";
const integrityCache = new WeakMap<
  V2Database,
  { at: number; healthy: boolean; foreignKeys: number }
>();
export function databaseIntegrity(db: V2Database) {
  const cached = integrityCache.get(db);
  if (cached && Date.now() - cached.at < 60_000) return cached;
  const value = {
    at: Date.now(),
    healthy: db.pragma("quick_check", { simple: true }) === "ok",
    foreignKeys: (db.pragma("foreign_key_check") as unknown[]).length,
  };
  integrityCache.set(db, value);
  return value;
}
export function realtimeHealthUrl() {
  if (process.env.REALTIME_HEALTH_URL) {
    const url = new URL(process.env.REALTIME_HEALTH_URL);
    if (
      !["http:", "https:"].includes(url.protocol) ||
      url.username ||
      url.password
    )
      throw new Error("Endereço interno de realtime inválido.");
    return url.toString();
  }
  // Public realtime may go through a proxy; use the internal port for health.
  return `http://127.0.0.1:${Number(process.env.REALTIME_PORT) || 3045}/health`;
}
export type OperationalHealth = {
  database: "operational" | "unavailable";
  canonical: "operational" | "unavailable" | "not-configured";
  storage: "operational" | "unavailable";
  realtime: "operational" | "unavailable" | "not-configured";
  maintenance: boolean;
  freeBytes: number | null;
  checkedAt: number;
};
let cached: { at: number; value: Promise<OperationalHealth> } | undefined;
export async function operationalHealth(
  fresh = false,
): Promise<OperationalHealth> {
  if (!fresh && cached && Date.now() - cached.at < 15_000) return cached.value;
  const value = (async () => {
    const result: OperationalHealth = {
      database: "unavailable",
      canonical:
        process.env.OPENSTUDYHUB_V2_ENABLED === "1"
          ? "unavailable"
          : "not-configured",
      storage: "unavailable",
      realtime: process.env.REALTIME_PUBLIC_URL
        ? "unavailable"
        : "not-configured",
      maintenance: backupMaintenanceActive(),
      freeBytes: null,
      checkedAt: Date.now(),
    };
    try {
      if (getDatabase().sqlite.prepare("SELECT count(*) n FROM users").get())
        result.database = "operational";
    } catch {
      /* Sanitized below */
    }
    if (process.env.OPENSTUDYHUB_V2_ENABLED === "1")
      try {
        withV2Db((db) => db.prepare("SELECT count(*) n FROM users").get());
        result.canonical = "operational";
      } catch {
        /* Sanitized below */
      }
    try {
      const configured = getServerEnvironment().PRIVATE_ASSET_PATH;
      const path = existsSync(configured) ? configured : dirname(configured);
      accessSync(path, constants.R_OK | constants.W_OK);
      const stats = statfsSync(path);
      result.freeBytes = stats.bavail * stats.bsize;
      result.storage =
        result.freeBytes > 32 * 1024 * 1024 ? "operational" : "unavailable";
    } catch {
      /* Sanitized below */
    }
    if (result.realtime !== "not-configured")
      try {
        const response = await fetch(realtimeHealthUrl(), {
          signal: AbortSignal.timeout(1500),
          cache: "no-store",
          redirect: "error",
        });
        if (response.ok && (await response.text()) === "ok")
          result.realtime = "operational";
      } catch {
        /* Realtime has polling fallback. */
      }
    return result;
  })();
  cached = { at: Date.now(), value };
  return value;
}
