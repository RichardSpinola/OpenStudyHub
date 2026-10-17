import { once } from "node:events";
import { stat, unlink, open } from "node:fs/promises";
import { pipeline } from "node:stream/promises";
import { Readable } from "node:stream";

import yauzl from "yauzl";
import yazl from "yazl";

import {
  normalizeProjectPath,
  projectUploadLimits,
  type ProjectSourceFile,
} from "@/lib/project-manifest";

function isSymlink(entry: yauzl.Entry): boolean {
  const unixMode = (entry.externalFileAttributes >>> 16) & 0xffff;
  return (unixMode & 0o170000) === 0o120000;
}

function openZip(source: Buffer | string): Promise<yauzl.ZipFile> {
  return new Promise((resolve, reject) => {
    const options = {
      lazyEntries: true,
      decodeStrings: true,
      validateEntrySizes: true,
    };
    const done = (error: Error | null, zip?: yauzl.ZipFile) =>
      error || !zip ? reject(error) : resolve(zip);
    if (typeof source === "string") yauzl.open(source, options, done);
    else yauzl.fromBuffer(source, options, done);
  });
}

function openEntry(zip: yauzl.ZipFile, entry: yauzl.Entry): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    zip.openReadStream(entry, (error, stream) => {
      if (error || !stream) {
        reject(error ?? new Error("ZIP entry unavailable."));
        return;
      }
      const chunks: Buffer[] = [];
      let size = 0;
      stream.on("data", (chunk: Buffer) => {
        size += chunk.length;
        if (size > projectUploadLimits.maxFileBytes) {
          stream.destroy(new Error("ZIP entry exceeds the file size limit."));
          return;
        }
        chunks.push(chunk);
      });
      stream.once("error", reject);
      stream.once("end", () => resolve(Buffer.concat(chunks)));
    });
  });
}

export async function readProjectZip(
  buffer: Buffer | string,
  onlyPath?: string,
): Promise<ProjectSourceFile[]> {
  const size =
    typeof buffer === "string" ? (await stat(buffer)).size : buffer.length;
  if (size > projectUploadLimits.maxArchiveBytes) {
    throw new Error("ZIP exceeds the upload size limit.");
  }
  const zip = await openZip(buffer);
  const files: ProjectSourceFile[] = [];
  let expandedSize = 0;
  let fileCount = 0;
  try {
    await new Promise<void>((resolve, reject) => {
      zip.once("error", reject);
      zip.once("end", resolve);
      zip.on("entry", (entry) => {
        void (async () => {
          try {
            if (/\/$/.test(entry.fileName)) {
              zip.readEntry();
              return;
            }
            if (isSymlink(entry)) {
              throw new Error("ZIP symlinks are not accepted.");
            }
            if (++fileCount > projectUploadLimits.maxFiles) {
              throw new Error("ZIP exceeds the file count limit.");
            }
            const path = normalizeProjectPath(entry.fileName);
            if (entry.uncompressedSize > projectUploadLimits.maxFileBytes) {
              throw new Error("ZIP entry exceeds the file size limit.");
            }
            expandedSize += entry.uncompressedSize;
            if (expandedSize > projectUploadLimits.maxTotalBytes) {
              throw new Error("ZIP exceeds the expanded size limit.");
            }
            const ratio =
              entry.uncompressedSize / Math.max(1, entry.compressedSize);
            if (
              entry.uncompressedSize > 1024 * 1024 &&
              ratio > projectUploadLimits.maxCompressionRatio
            ) {
              throw new Error("ZIP compression ratio is unsafe.");
            }
            if (!onlyPath || path === onlyPath)
              files.push({ path, data: await openEntry(zip, entry) });
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
  return files;
}

export async function createProjectZipFile(
  files: ProjectSourceFile[],
  target: string,
) {
  const zip = new yazl.ZipFile();
  for (const file of files)
    zip.addReadStreamLazy(
      normalizeProjectPath(file.path),
      { mode: 0o100644, mtime: new Date(0), size: file.data.length },
      (done) => done(null, Readable.from([file.data])),
    );
  const file = await open(target, "wx", 0o600);
  const output = file.createWriteStream();
  const done = pipeline(zip.outputStream, output);
  zip.end();
  try {
    await done;
  } catch (error) {
    await unlink(target).catch(() => undefined);
    throw error;
  }
}

export async function createProjectZip(
  files: Array<ProjectSourceFile & { path: string }>,
): Promise<Buffer> {
  const zip = new yazl.ZipFile();
  for (const file of files) {
    zip.addBuffer(file.data, normalizeProjectPath(file.path), {
      mode: 0o100644,
      mtime: new Date(0),
    });
  }
  zip.end();
  const chunks: Buffer[] = [];
  zip.outputStream.on("data", (chunk: Buffer) => chunks.push(chunk));
  await once(zip.outputStream, "end");
  return Buffer.concat(chunks);
}
