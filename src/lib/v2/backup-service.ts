import { randomUUID } from "node:crypto";
import {
  createReadStream,
  existsSync,
  readFileSync,
  writeFileSync,
  renameSync,
  mkdirSync,
  chmodSync,
  unlinkSync,
  statSync,
  realpathSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import { z } from "zod";
import { backupDirectory, createManualBackup } from "./manual-backup";
import { encryptBackup } from "./backup-crypto";
import { withBackupLease } from "./maintenance";
import { withV2Db, withV2DbAsync, v2RuntimePath } from "./runtime-database";
import { storageOwnerStatus } from "./drive-storage";
import { googleAccessTokenV2 } from "./google-oauth";
const configSchema = z.object({
  enabled: z.boolean().default(false),
  time: z
    .string()
    .regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/)
    .default("03:00"),
  timeZone: z
    .string()
    .max(80)
    .refine((zone) => {
      try {
        new Intl.DateTimeFormat("en", { timeZone: zone }).format();
        return true;
      } catch {
        return false;
      }
    }, "Fuso inválido.")
    .default("America/Bahia"),
  retention: z.number().int().min(1).max(90).default(7),
  destination: z.enum(["local", "local-drive"]).default("local"),
  lastAttemptDay: z.string().nullable().default(null),
  workerSeenAt: z.number().nullable().default(null),
});
export type BackupConfig = z.infer<typeof configSchema>;
export type BackupRun = {
  id: string;
  kind: "manual" | "automatic";
  createdAt: number;
  status: "complete" | "local-only" | "error";
  driveId?: string;
  message?: string;
};
function controlDirectory() {
  return join(dirname(v2RuntimePath()), "backup-control");
}
function configPath() {
  return join(controlDirectory(), "schedule.json");
}
function keyPath() {
  return join(controlDirectory(), "recovery.key");
}
function runsPath() {
  return join(controlDirectory(), "runs.json");
}
function secureDirectory(path: string) {
  mkdirSync(path, { recursive: true, mode: 0o700 });
  if (realpathSync(path) !== resolve(path))
    throw new Error("Pasta de backup não pode conter links simbólicos.");
  chmodSync(path, 0o700);
}
function writeJson(path: string, value: unknown) {
  secureDirectory(dirname(path));
  const temp = `${path}.${randomUUID()}.tmp`;
  try {
    writeFileSync(temp, JSON.stringify(value), { mode: 0o600, flag: "wx" });
    renameSync(temp, path);
  } finally {
    if (existsSync(temp)) unlinkSync(temp);
  }
}
export function backupConfig(): BackupConfig {
  if (!existsSync(configPath())) return configSchema.parse({});
  const config = configSchema.parse(
    JSON.parse(readFileSync(configPath(), "utf8")),
  );
  const worker = join(controlDirectory(), "worker.json");
  if (existsSync(worker))
    config.workerSeenAt = (
      JSON.parse(readFileSync(worker, "utf8")) as { seenAt: number }
    ).seenAt;
  return config;
}
export function backupRuns(): BackupRun[] {
  if (!existsSync(runsPath())) return [];
  return JSON.parse(readFileSync(runsPath(), "utf8")) as BackupRun[];
}
export function hasRecoveryKey() {
  return existsSync(keyPath());
}
export function saveBackupConfig(input: unknown, key?: string) {
  const value = configSchema.parse(input);
  if (value.destination === "local-drive") {
    const owner = withV2Db(storageOwnerStatus);
    if (!owner?.connected || !owner.rootReady)
      throw new Error(
        "Configure a conta responsável e a pasta do Drive antes de escolher esse destino.",
      );
  }
  if (key && hasRecoveryKey())
    throw new Error("Uma chave já está configurada. Ela foi mantida.");
  if (
    key &&
    (!/^[A-Za-z0-9_-]{43}$/.test(key) ||
      Buffer.from(key, "base64url").toString("base64url") !== key)
  )
    throw new Error("Chave inválida.");
  if (!key && !hasRecoveryKey())
    throw new Error("Guarde e confirme a chave de recuperação primeiro.");
  // Settings updates cannot reset scheduler state or race with an executing job.
  const current = backupConfig();
  if (key) {
    secureDirectory(controlDirectory());
    writeFileSync(keyPath(), key, { mode: 0o600, flag: "wx" });
  }
  try {
    writeJson(configPath(), {
      ...value,
      lastAttemptDay: current.lastAttemptDay,
      workerSeenAt: current.workerSeenAt,
    });
  } catch (error) {
    if (key) unlinkSync(keyPath());
    throw error;
  }
}
export function scheduleDay(
  now: number,
  config: Pick<BackupConfig, "timeZone" | "time">,
) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: config.timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const part = (type: string) =>
    parts.find((p) => p.type === type)?.value ?? "";
  return {
    day: `${part("year")}-${part("month")}-${part("day")}`,
    due: `${part("hour")}:${part("minute")}` >= config.time,
  };
}
function archivePath(id: string) {
  if (!/^[0-9a-f-]{36}$/.test(id)) throw new Error("Backup inválido.");
  return join(backupDirectory(), `${id}.oshbackup`);
}
export function encryptedBackupPath(id: string) {
  return archivePath(id);
}
async function driveUpload(path: string, run: BackupRun): Promise<string> {
  return withV2DbAsync(async (db) => {
    const owner = storageOwnerStatus(db);
    if (!owner?.connected || !owner.rootReady || !owner.ownerId)
      throw new Error("Drive indisponível.");
    const root = (
      db
        .prepare("SELECT root_ref ref FROM storage_backends WHERE id=?")
        .get(owner.backendId) as { ref: string }
    ).ref;
    const token = await googleAccessTokenV2(db, owner.ownerId);
    const response = await fetch(
      "https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&fields=id",
      {
        method: "POST",
        headers: {
          authorization: `Bearer ${token}`,
          "content-type": "application/json",
          "x-upload-content-type": "application/octet-stream",
          "x-upload-content-length": String(statSync(path).size),
        },
        body: JSON.stringify({
          name: `OpenStudyHub-${run.kind}-${run.id}.oshbackup`,
          parents: [root],
          appProperties: { openstudyhubBackup: run.id },
        }),
        signal: AbortSignal.timeout(20_000),
      },
    );
    const location = response.headers.get("location");
    if (
      !response.ok ||
      !location ||
      new URL(location).protocol !== "https:" ||
      new URL(location).hostname !== "www.googleapis.com"
    )
      throw new Error("Drive não iniciou a cópia.");
    const stream = createReadStream(path);
    try {
      const uploaded = await fetch(location, {
        method: "PUT",
        headers: {
          "content-length": String(statSync(path).size),
          "content-type": "application/octet-stream",
        },
        body: stream as unknown as BodyInit,
        duplex: "half",
        signal: AbortSignal.timeout(300_000),
      } as RequestInit);
      if (!uploaded.ok) throw new Error("Drive não concluiu a cópia.");
      const data = (await uploaded.json()) as { id?: string };
      if (!data.id || !/^[\w-]+$/.test(data.id))
        throw new Error("Drive não confirmou o arquivo.");
      return data.id;
    } finally {
      stream.destroy();
    }
  });
}
async function driveDelete(id: string) {
  await withV2DbAsync(async (db) => {
    const owner = storageOwnerStatus(db);
    if (!owner?.connected || !owner.ownerId)
      throw new Error("Drive indisponível para retenção.");
    const token = await googleAccessTokenV2(db, owner.ownerId);
    const response = await fetch(
      `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(id)}`,
      {
        method: "DELETE",
        headers: { authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(20_000),
      },
    );
    if (!response.ok && response.status !== 404)
      throw new Error("Não foi possível aplicar retenção no Drive.");
  });
}
export async function runEncryptedBackup(
  kind: "manual" | "automatic" = "manual",
  scheduledDay?: string,
): Promise<BackupRun> {
  return withBackupLease(async () => {
    const config = backupConfig();
    if (!hasRecoveryKey())
      throw new Error("Configure a chave de recuperação primeiro.");
    // Recheck inside the cross-process lock: two workers may have seen the same due time.
    if (
      scheduledDay &&
      (!config.enabled || config.lastAttemptDay === scheduledDay)
    )
      throw new Error("Agendamento já executado.");
    if (scheduledDay)
      writeJson(configPath(), { ...config, lastAttemptDay: scheduledDay });
    const run: BackupRun = {
      id: randomUUID(),
      kind,
      createdAt: Date.now(),
      status: "error",
    };
    let zip: string | null = null;
    const target = archivePath(run.id),
      partial = `${target}.pending`;
    try {
      const snapshot = await createManualBackup({ leaseHeld: true });
      zip = snapshot.path;
      await encryptBackup(zip, partial, readFileSync(keyPath(), "utf8").trim());
      renameSync(partial, target);
      unlinkSync(zip);
      zip = null;
      run.status = "complete";
      if (config.destination === "local-drive") {
        try {
          run.driveId = await driveUpload(target, run);
        } catch {
          run.status = "local-only";
          run.message =
            "Cópia local protegida. Cópia no Drive falhou; revise a integração antes do próximo backup.";
        }
      }
    } catch {
      run.status = "error";
      run.message =
        "Backup não concluído. Confira espaço, permissões e integridade dos bancos. A última cópia válida foi mantida.";
    } finally {
      if (zip && existsSync(zip)) unlinkSync(zip);
      if (existsSync(partial)) unlinkSync(partial);
    }
    const records = [run, ...backupRuns()];
    writeJson(runsPath(), records);
    if (run.status === "complete" && kind === "automatic") {
      const expired = records
        .filter((r) => r.kind === "automatic" && r.status === "complete")
        .slice(config.retention);
      for (const old of expired) {
        try {
          if (old.driveId) await driveDelete(old.driveId);
          const path = archivePath(old.id);
          if (existsSync(path)) unlinkSync(path);
          records.splice(
            records.findIndex((r) => r.id === old.id),
            1,
          );
        } catch {
          run.message =
            "Backup concluído. Uma cópia antiga foi mantida porque a limpeza não terminou.";
        }
      }
      writeJson(runsPath(), records);
    }
    return run;
  });
}
let ticking = false;
export async function tickBackupSchedule(now = Date.now()) {
  if (ticking) return;
  ticking = true;
  try {
    const config = backupConfig();
    const { day, due } = scheduleDay(now, config);
    writeJson(join(controlDirectory(), "worker.json"), { seenAt: now });
    if (config.enabled && due && config.lastAttemptDay !== day)
      await runEncryptedBackup("automatic", day);
  } finally {
    ticking = false;
  }
}
