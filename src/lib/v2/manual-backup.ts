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
  rmSync,
} from "node:fs";
import { dirname, join, resolve, relative, sep } from "node:path";
import { pipeline } from "node:stream/promises";
import yazl from "yazl";
import { getServerEnvironment } from "@/lib/env";
import { v2RuntimePath } from "./runtime-database";
import { withBackupLease, finishBackupSnapshot } from "./maintenance";

export type BackupManifest = {
  format: "openstudyhub-v2-manual-backup";
  version: 1;
  createdAt: string;
  files: Record<string, string>;
  notice: string;
  coverage?: {
    managedFiles: number;
    remoteReferences: number;
    noteImagesInDatabase: number;
    externalFilesCopied: false;
  };
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
              ) ||
              /^chat\/[0-9a-f-]{36}\.bin$/.test(name) ||
              /^projects\/(versions|staging)\/[0-9a-f-]{36}\.zip$/.test(name)
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

function assertManagedInventory(
  legacy: Database.Database,
  canonical: Database.Database,
  names: Set<string>,
) {
  const requireFile = (name: string) => {
    if (!names.has(name))
      throw new Error(
        "Há arquivo local referenciado mas ausente. Revise o armazenamento antes do backup.",
      );
  };
  const rows = (db: Database.Database, table: string, column: string) => {
    if (
      !db
        .prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?")
        .get(table)
    )
      return [];
    return db
      .prepare(
        `SELECT ${column} ref FROM ${table} WHERE ${column} IS NOT NULL AND ${column}<>''`,
      )
      .all() as { ref: string }[];
  };
  for (const [table, column, prefix] of [
    ["users", "avatar_storage_name", "profiles/"],
    ["users", "banner_storage_name", "profiles/"],
    ["shortcuts", "icon_storage_name", "shortcut-icons/"],
    ["user_shortcuts", "icon_storage_name", "shortcut-icons/"],
    ["user_home_assets", "storage_name", ""],
    ["chat_attachments", "storage_name", "chat/"],
  ])
    for (const row of rows(legacy, table, column))
      requireFile(`assets/private/${prefix}${row.ref}`);
  for (const table of ["user_home_wallpapers", "offering_covers"])
    for (const row of rows(canonical, table, "storage_name"))
      requireFile(`assets/private/${row.ref}`);
  for (const row of rows(legacy, "project_versions", "archive_drive_file_id"))
    if (row.ref.startsWith("local:"))
      requireFile(`assets/private/projects/versions/${row.ref.slice(6)}.zip`);
  for (const row of canonical
    .prepare(
      "SELECT o.provider_ref ref FROM storage_objects o JOIN storage_backends b ON b.id=o.backend_id WHERE b.kind='local' AND o.archived_at IS NULL",
    )
    .all() as { ref: string }[])
    requireFile(`assets/local/${row.ref}`);
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

export async function createManualBackup(
  options: { leaseHeld?: boolean } = {},
): Promise<{
  id: string;
  path: string;
  createdAt: string;
}> {
  if (!options.leaseHeld)
    return withBackupLease(() => createManualBackup({ leaseHeld: true }));
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
  const guards: Database.Database[] = [];
  try {
    // Block new requests first, then let short in-flight writes settle. Both DBs
    // remain write-locked until their snapshots and managed files are staged.
    await new Promise<void>((resolve) => setTimeout(resolve, 1200));
    for (const path of [v1Path, v2Path]) {
      const guard = new Database(path, { fileMustExist: true });
      guards.push(guard);
      guard.pragma("busy_timeout=5000");
      guard.exec("BEGIN IMMEDIATE");
    }
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
    const assets = assetRoots.flatMap(({ root, prefix }) =>
      safeFiles(root, prefix),
    );
    assertManagedInventory(
      guards[0],
      guards[1],
      new Set(assets.map((file) => file.name)),
    );
    if (assets.length > 19997)
      throw new Error("Backup excede o limite de arquivos.");
    let totalBytes =
      copies.reduce((sum, file) => sum + statSync(file.target).size, 0) +
      8 * 1024 * 1024;
    const stagedAssets: Array<{ source: string; name: string }> = [];
    for (const file of assets) {
      const size = statSync(file.source).size;
      totalBytes += size;
      if (size > 1024 ** 3 || totalBytes > 4 * 1024 ** 3)
        throw new Error("Backup excede o limite de tamanho.");
      const target = join(temporary, file.name);
      mkdirSync(dirname(target), { recursive: true, mode: 0o700 });
      await pipeline(
        createReadStream(file.source),
        createWriteStream(target, { flags: "wx", mode: 0o600 }),
      );
      stagedAssets.push({ source: target, name: file.name });
    }
    const canonical = guards[1];
    let remoteObjects = (
      canonical
        .prepare(
          "SELECT count(*) n FROM storage_objects o JOIN storage_backends b ON b.id=o.backend_id WHERE b.kind='google-drive' AND o.archived_at IS NULL",
        )
        .get() as { n: number }
    ).n;
    for (const query of [
      "SELECT count(*) n FROM generated_documents WHERE drive_file_id IS NOT NULL",
      "SELECT count(*) n FROM document_templates",
      "SELECT count(*) n FROM projects WHERE storage_backend='google-drive' AND drive_project_folder_id IS NOT NULL",
    ])
      remoteObjects += (guards[0].prepare(query).get() as { n: number }).n;
    const noteImagesInDatabase = guards[0]
      .prepare("SELECT 1 FROM sqlite_master WHERE name='note_images'")
      .get()
      ? (
          guards[0].prepare("SELECT count(*) n FROM note_images").get() as {
            n: number;
          }
        ).n
      : 0;
    for (const guard of guards.splice(0)) {
      guard.exec("ROLLBACK");
      guard.close();
    }
    finishBackupSnapshot();
    const files = [
      ...copies.map(({ target, name }) => ({ source: target, name })),
      ...stagedAssets,
    ];
    const manifest: BackupManifest = {
      format: "openstudyhub-v2-manual-backup",
      version: 1,
      createdAt,
      files: {},
      coverage: {
        managedFiles: assets.length,
        remoteReferences: remoteObjects,
        noteImagesInDatabase,
        externalFilesCopied: false,
      },
      notice:
        "Bancos e arquivos locais geridos, incluindo imagens de notas no banco. Referências externas e arquivos do Drive NÃO são copiados. Dados privados e hashes de senha presentes. Sessões e tokens OAuth removidos; reconecte Google e push após restaurar. Ambiente e secrets devem ser configurados separadamente.",
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
    for (const guard of guards) {
      if (guard.inTransaction) guard.exec("ROLLBACK");
      guard.close();
    }
    rmSync(temporary, { recursive: true, force: true });
  }
}
