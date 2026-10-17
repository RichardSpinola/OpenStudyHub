import { getServerEnvironment } from "./env";
import { randomUUID } from "node:crypto";
import {
  mkdir,
  readFile,
  writeFile,
  realpath,
  unlink,
  copyFile,
} from "node:fs/promises";
import { constants, createReadStream } from "node:fs";
import { Readable } from "node:stream";
import { dirname, join, resolve } from "node:path";
import type { DatabaseConnection } from "./db/client";
import { readProjectZip } from "./project-archive";
export function projectAssetsRoot(connection: DatabaseConnection) {
  return resolve(
    process.env.PRIVATE_ASSET_PATH ??
      (connection.sqlite.name === ":memory:"
        ? "/tmp/osh-project-test-assets"
        : getServerEnvironment().PRIVATE_ASSET_PATH),
    "projects",
  );
}
export function projectStagingRoot(connection: DatabaseConnection) {
  return join(projectAssetsRoot(connection), "staging");
}
function archivePath(connection: DatabaseConnection, ref: string) {
  if (!/^local:[0-9a-f-]{36}$/.test(ref))
    throw new Error("Arquivo de projeto inválido.");
  return join(projectAssetsRoot(connection), "versions", ref.slice(6) + ".zip");
}
export async function saveLocalProjectArchive(
  connection: DatabaseConnection,
  bytes: Buffer | string,
) {
  const ref = "local:" + randomUUID(),
    path = archivePath(connection, ref);
  await mkdir(dirname(path), { recursive: true, mode: 0o700 });
  if ((await realpath(dirname(path))) !== dirname(path))
    throw new Error("Diretório de projeto inválido.");
  if (typeof bytes === "string")
    await copyFile(bytes, path, constants.COPYFILE_EXCL);
  else await writeFile(path, bytes, { flag: "wx", mode: 0o600 });
  return ref;
}
export async function readLocalProjectArchive(
  connection: DatabaseConnection,
  ref: string,
) {
  const path = archivePath(connection, ref);
  if ((await realpath(path)) !== path)
    throw new Error("Arquivo de projeto inválido.");
  return readFile(path);
}
export async function streamLocalProjectArchive(
  connection: DatabaseConnection,
  ref: string,
) {
  const path = archivePath(connection, ref);
  if ((await realpath(path)) !== path)
    throw new Error("Arquivo de projeto inválido.");
  return Readable.toWeb(createReadStream(path)) as ReadableStream<Uint8Array>;
}
export async function removeLocalProjectArchive(
  connection: DatabaseConnection,
  ref: string,
) {
  const path = archivePath(connection, ref);
  if ((await realpath(path)) !== path)
    throw new Error("Arquivo de projeto inválido.");
  await unlink(path);
}
export async function readLocalProjectSource(
  connection: DatabaseConnection,
  ref: string,
  path: string,
) {
  const archive = archivePath(connection, ref);
  if ((await realpath(archive)) !== archive)
    throw new Error("Arquivo de projeto inválido.");
  const files = await readProjectZip(archive, path);
  const file = files.find((f) => f.path === path);
  if (!file) throw new Error("Arquivo não encontrado nesta versão.");
  return file.data;
}
