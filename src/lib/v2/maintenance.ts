import Database from "better-sqlite3";
import {
  existsSync,
  readFileSync,
  writeFileSync,
  unlinkSync,
  mkdirSync,
} from "node:fs";
import { dirname, join } from "node:path";
import { randomUUID } from "node:crypto";

export function maintenancePath() {
  const path = process.env.OPENSTUDYHUB_V2_DATABASE_PATH;
  return path?.startsWith("/")
    ? join(dirname(path), ".backup-maintenance.json")
    : null;
}
// PIDs belong to each container's namespace. The shared SQLite lock is the
// authority for liveness, including after a worker is killed or restarted.
export function backupLeaseActive(): boolean {
  const path = maintenancePath();
  if (!path) return false;
  const coordinatorPath = join(dirname(path), ".backup-coordinator.sqlite");
  if (!existsSync(coordinatorPath)) return false;
  const db = new Database(coordinatorPath, { fileMustExist: true });
  db.pragma("busy_timeout=0");
  try {
    db.exec("BEGIN IMMEDIATE");
    db.exec("ROLLBACK");
    return false;
  } catch (error) {
    if ((error as { code?: string }).code === "SQLITE_BUSY") return true;
    throw error;
  } finally {
    db.close();
  }
}
export function backupMaintenanceActive() {
  const path = maintenancePath();
  if (!path || !existsSync(path)) return false;
  try {
    const record = JSON.parse(readFileSync(path, "utf8"));
    return (
      record.phase !== "export" &&
      Number.isSafeInteger(record.pid) &&
      backupLeaseActive()
    );
  } catch {
    return true;
  } // Damaged locks fail closed until an administrator reviews them.
}
export async function withBackupLease<T>(work: () => Promise<T>): Promise<T> {
  const path = maintenancePath();
  if (!path) throw new Error("Banco canônico não configurado.");
  mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
  const coordinator = new Database(
    join(dirname(path), ".backup-coordinator.sqlite"),
  );
  coordinator.pragma("busy_timeout=0");
  coordinator.exec("CREATE TABLE IF NOT EXISTS mutex(id INTEGER PRIMARY KEY)");
  try {
    coordinator.exec("BEGIN IMMEDIATE");
  } catch {
    coordinator.close();
    throw new Error("Já há um backup em andamento.");
  }
  const id = randomUUID();
  try {
    writeFileSync(
      path,
      JSON.stringify({
        pid: process.pid,
        id,
        phase: "snapshot",
        startedAt: Date.now(),
      }),
      { mode: 0o600 },
    );
    return await work();
  } finally {
    // Do not remove a newer operator's lock.
    try {
      if (JSON.parse(readFileSync(path, "utf8")).id === id) unlinkSync(path);
    } catch {
      /* Already removed */
    }
    coordinator.exec("ROLLBACK");
    coordinator.close();
  }
}

export function finishBackupSnapshot() {
  const path = maintenancePath();
  if (!path) return;
  const record = JSON.parse(readFileSync(path, "utf8"));
  if (record.pid !== process.pid)
    throw new Error("Backup pertence a outro processo.");
  writeFileSync(path, JSON.stringify({ ...record, phase: "export" }), {
    mode: 0o600,
  });
}
