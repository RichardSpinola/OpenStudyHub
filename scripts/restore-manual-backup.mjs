// Offline-only restore. Stop App, Admin and realtime before using this command.
import Database from "better-sqlite3";
import yauzl from "yauzl";
import { createHash } from "node:crypto";
import {
  createReadStream,
  createWriteStream,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  renameSync,
  rmSync,
  statSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import { pipeline } from "node:stream/promises";

const [archiveInput, confirmation, stopped] = process.argv.slice(2);
const v1 = process.env.DATABASE_PATH;
const v2 = process.env.OPENSTUDYHUB_V2_DATABASE_PATH;
const privateAssets = process.env.PRIVATE_ASSET_PATH;
if (
  !archiveInput ||
  confirmation !== "--confirm-restore" ||
  stopped !== "--services-stopped" ||
  !v1?.startsWith("/") ||
  !v2?.startsWith("/") ||
  !privateAssets?.startsWith("/")
) {
  console.error(
    "Uso: DATABASE_PATH=/caminho/v1.db OPENSTUDYHUB_V2_DATABASE_PATH=/caminho/v2.db PRIVATE_ASSET_PATH=/caminho/private-assets node scripts/restore-manual-backup.mjs /caminho/backup.zip --confirm-restore --services-stopped",
  );
  process.exit(2);
}
if (resolve(v1) === resolve(v2))
  throw new Error("Os bancos V1 e V2 precisam ser separados.");
const archive = resolve(archiveInput);
if (!existsSync(archive) || !statSync(archive).isFile())
  throw new Error("Backup indisponível.");
mkdirSync(dirname(resolve(v2)), { recursive: true });
const stage = mkdtempSync(join(dirname(resolve(v2)), ".openstudyhub-restore-"));

function allowed(name) {
  return (
    name === "manifest.json" ||
    name === "databases/v1.sqlite" ||
    name === "databases/v2.sqlite" ||
    /^(assets\/(private|local))\/[^\\\0]+$/.test(name)
  );
}
function safeName(name) {
  return (
    allowed(name) &&
    !name.startsWith("/") &&
    name.split("/").every((piece) => piece && piece !== "." && piece !== "..")
  );
}
async function sha256(path) {
  const hash = createHash("sha256");
  for await (const part of createReadStream(path)) hash.update(part);
  return hash.digest("hex");
}
async function extract() {
  const zip = await new Promise((ok, reject) =>
    yauzl.open(
      archive,
      { lazyEntries: true, decodeStrings: true, validateEntrySizes: true },
      (error, file) => (error ? reject(error) : ok(file)),
    ),
  );
  const names = new Set();
  let total = 0;
  try {
    await new Promise((ok, reject) => {
      zip.on("error", reject);
      zip.on("end", ok);
      zip.on("entry", (entry) => {
        void (async () => {
          try {
            const name = entry.fileName;
            const mode = (entry.externalFileAttributes >>> 16) & 0o170000;
            if (
              !safeName(name) ||
              names.has(name) ||
              mode === 0o120000 ||
              names.size >= 20000
            )
              throw new Error("Entrada ZIP inválida.");
            names.add(name);
            total += entry.uncompressedSize;
            if (
              total > 4 * 1024 * 1024 * 1024 ||
              entry.uncompressedSize > 1024 * 1024 * 1024
            )
              throw new Error("Backup excede o tamanho seguro.");
            const path = join(stage, ...name.split("/"));
            mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
            const stream = await new Promise((yes, no) =>
              zip.openReadStream(entry, (error, input) =>
                error ? no(error) : yes(input),
              ),
            );
            await pipeline(
              stream,
              createWriteStream(path, { flags: "wx", mode: 0o600 }),
            );
            zip.readEntry();
          } catch (error) {
            reject(error);
            zip.close();
          }
        })();
      });
      zip.readEntry();
    });
  } finally {
    zip.close();
  }
  return names;
}
function checkDatabase(path) {
  const db = new Database(path, { readonly: true, fileMustExist: true });
  try {
    if (
      db.pragma("integrity_check", { simple: true }) !== "ok" ||
      db.pragma("foreign_key_check").length
    )
      throw new Error("Backup possui banco inválido.");
  } finally {
    db.close();
  }
}
async function main() {
  const names = await extract();
  if (
    !names.has("manifest.json") ||
    !names.has("databases/v1.sqlite") ||
    !names.has("databases/v2.sqlite")
  )
    throw new Error("Backup incompleto.");
  const manifest = JSON.parse(
    readFileSync(join(stage, "manifest.json"), "utf8"),
  );
  if (
    manifest.format !== "openstudyhub-v2-manual-backup" ||
    manifest.version !== 1 ||
    typeof manifest.files !== "object"
  )
    throw new Error("Formato de backup não reconhecido.");
  const files = [...names].filter((name) => name !== "manifest.json");
  if (files.length !== Object.keys(manifest.files).length)
    throw new Error("Inventário do backup diverge.");
  for (const name of files)
    if (
      (await sha256(join(stage, ...name.split("/")))) !== manifest.files[name]
    )
      throw new Error(`Checksum inválido: ${name}`);
  checkDatabase(join(stage, "databases/v1.sqlite"));
  checkDatabase(join(stage, "databases/v2.sqlite"));
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const operations = [
    { source: join(stage, "databases/v1.sqlite"), target: resolve(v1) },
    { source: join(stage, "databases/v2.sqlite"), target: resolve(v2) },
    { source: join(stage, "assets/private"), target: resolve(privateAssets) },
    {
      source: join(stage, "assets/local"),
      target: join(dirname(resolve(v2)), "local-assets"),
    },
  ];
  const moved = [];
  const installed = [];
  try {
    for (const item of operations) {
      mkdirSync(dirname(item.target), { recursive: true });
      const old = `${item.target}.pre-restore-${stamp}`;
      if (existsSync(item.target)) {
        renameSync(item.target, old);
        moved.push({ target: item.target, old });
      }
      if (existsSync(item.source)) renameSync(item.source, item.target);
      else mkdirSync(item.target, { recursive: true, mode: 0o700 });
      installed.push(item.target);
    }
  } catch (error) {
    for (const target of installed.reverse())
      if (existsSync(target)) rmSync(target, { recursive: true, force: true });
    for (const previous of moved.reverse())
      if (existsSync(previous.old)) renameSync(previous.old, previous.target);
    throw error;
  }
  console.log(
    `Restauração validada e aplicada. Cópias anteriores: *.pre-restore-${stamp}. Reinicie os serviços e reconecte o Google.`,
  );
}
try {
  await main();
} finally {
  rmSync(stage, { recursive: true, force: true });
}
