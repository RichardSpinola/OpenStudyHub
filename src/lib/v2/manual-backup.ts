import Database from "better-sqlite3";
import { createHash, randomUUID } from "node:crypto";
import {
  createWriteStream,
  createReadStream,
  existsSync,
  mkdirSync,
  readdirSync,
  statSync,
  lstatSync,
  chmodSync,
  unlinkSync,
  rmdirSync,
} from "node:fs";
import { dirname, join, resolve, relative, sep } from "node:path";
import { pipeline } from "node:stream/promises";
import yazl from "yazl";
import { getServerEnvironment } from "@/lib/env";
import { v2RuntimePath } from "./runtime";

export type BackupManifest = {
  format: "openstudyhub-v2-manual-backup";
  version: 1;
  createdAt: string;
  files: Record<string, string>;
  notice: string;
};

export function backupDirectory(): string {
  return join(dirname(v2RuntimePath()), "backups");
}

function safeFiles(
  root: string,
  prefix: string,
): Array<{ source: string; name: string }> {
  if (!existsSync(root)) return [];
  if (lstatSync(root).isSymbolicLink())
    throw new Error("Pasta de assets não pode ser um link simbólico.");
  const result: Array<{ source: string; name: string }> = [];
  function walk(folder: string) {
    for (const entry of readdirSync(folder, { withFileTypes: true })) {
      const path = join(folder, entry.name);
      if (entry.isSymbolicLink())
        throw new Error("Asset com link simbólico não pode entrar no backup.");
      if (entry.isDirectory()) walk(path);
      else if (entry.isFile()) {
        const name = relative(root, path).split(sep).join("/");
        const accepted =
          prefix === "assets/private"
            ? /^(?:(?:chat|profiles|shortcut-icons|offering-covers)\/)?[0-9a-f-]{36}\.(?:png|jpg|webp)$/.test(
                name,
              )
            : /^[0-9a-f-]{36}$/.test(name);
        if (!accepted)
          throw new Error(
            `Asset não reconhecido no diretório ${prefix}; revise antes de criar o backup.`,
          );
        result.push({ source: path, name: `${prefix}/${name}` });
      }
    }
  }
  walk(root);
  return result;
}

async function sha256(path: string): Promise<string> {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(path)) hash.update(chunk);
  return hash.digest("hex");
}

function removeCredentials(path: string, kind: "v1" | "v2"): void {
  const db = new Database(path);
  try {
    db.pragma("foreign_keys = ON");
    db.transaction(() => {
      if (kind === "v1") {
        db.exec(
          "DELETE FROM sessions; DELETE FROM google_oauth_states; UPDATE google_connections SET encrypted_refresh_token=NULL, status='revoked';",
        );
        db.prepare(
          "DELETE FROM app_settings WHERE lower(key) LIKE '%token%' OR lower(key) LIKE '%secret%' OR lower(key) LIKE '%password%'",
        ).run();
      } else {
        db.exec(
          "DELETE FROM admin_sessions; DELETE FROM user_sessions; DELETE FROM google_oauth_states_v2; DELETE FROM push_subscriptions; UPDATE google_connections_v2 SET encrypted_refresh_token=NULL, status='needs_reconnect';",
        );
      }
    })();
    if (
      db.pragma("integrity_check", { simple: true }) !== "ok" ||
      (db.pragma("foreign_key_check") as unknown[]).length
    ) {
      throw new Error("Cópia de backup não passou na integridade.");
    }
  } finally {
    db.close();
  }
}

export async function createManualBackup(): Promise<{
  id: string;
  path: string;
  createdAt: string;
}> {
  const env = getServerEnvironment();
  const v1Path = resolve(env.DATABASE_PATH);
  const v2Path = v2RuntimePath();
  if (!existsSync(v1Path) || !existsSync(v2Path))
    throw new Error("Bancos não encontrados.");
  const dir = backupDirectory();
  mkdirSync(dir, { recursive: true, mode: 0o700 });
  chmodSync(dir, 0o700);
  const id = randomUUID();
  const createdAt = new Date().toISOString();
  const temporary = join(dir, `.pending-${id}`);
  mkdirSync(temporary, { mode: 0o700 });
  const archivePath = join(dir, `${id}.zip`);
  try {
    const copies = [
      {
        source: v1Path,
        target: join(temporary, "v1.sqlite"),
        name: "databases/v1.sqlite",
        kind: "v1" as const,
      },
      {
        source: v2Path,
        target: join(temporary, "v2.sqlite"),
        name: "databases/v2.sqlite",
        kind: "v2" as const,
      },
    ];
    for (const copy of copies) {
      const source = new Database(copy.source, {
        readonly: true,
        fileMustExist: true,
      });
      try {
        await source.backup(copy.target);
      } finally {
        source.close();
      }
      removeCredentials(copy.target, copy.kind);
    }
    const assetRoots = [
      { root: resolve(env.PRIVATE_ASSET_PATH), prefix: "assets/private" },
      { root: join(dirname(v2Path), "local-assets"), prefix: "assets/local" },
    ];
    const files = [
      ...copies.map(({ target, name }) => ({ source: target, name })),
      ...assetRoots.flatMap(({ root, prefix }) => safeFiles(root, prefix)),
    ];
    const manifest: BackupManifest = {
      format: "openstudyhub-v2-manual-backup",
      version: 1,
      createdAt,
      files: {},
      notice:
        "Dados de usuários e hashes de senha. Sessões e tokens OAuth foram removidos; reconecte o Google e configure o push após restaurar.",
    };
    const zip = new yazl.ZipFile();
    for (const file of files) {
      if (statSync(file.source).size > 1024 * 1024 * 1024)
        throw new Error("Um arquivo excede 1 GiB.");
      manifest.files[file.name] = await sha256(file.source);
      zip.addFile(file.source, file.name, {
        mode: 0o100600,
        mtime: new Date(createdAt),
      });
    }
    zip.addBuffer(
      Buffer.from(JSON.stringify(manifest, null, 2)),
      "manifest.json",
      { mode: 0o100600 },
    );
    zip.end();
    await pipeline(
      zip.outputStream,
      createWriteStream(archivePath, { flags: "wx", mode: 0o600 }),
    );
    return { id, path: archivePath, createdAt };
  } catch (error) {
    if (existsSync(archivePath)) unlinkSync(archivePath);
    throw error;
  } finally {
    for (const name of ["v1.sqlite", "v2.sqlite"]) {
      const path = join(temporary, name);
      if (existsSync(path)) unlinkSync(path);
    }
    rmdirSync(temporary);
  }
}
