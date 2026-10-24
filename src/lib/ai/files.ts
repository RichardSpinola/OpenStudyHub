import { mkdir, readFile, writeFile, unlink } from "node:fs/promises";
import { join, resolve } from "node:path";
import { randomUUID } from "node:crypto";
import yauzl from "yauzl";
import sharp from "sharp";
import { getServerEnvironment } from "@/lib/env";
export const AI_FILE_BYTES = 10 * 1024 * 1024;
export const AI_TEXT_LIMIT = 50_000;
function assetPath(key: string) {
  if (!/^[a-f0-9-]{36}\.bin$/.test(key)) throw new Error("Invalid asset");
  return join(resolve(getServerEnvironment().PRIVATE_ASSET_PATH), "ai", key);
}
export async function saveAiAsset(bytes: Buffer) {
  const key = `${randomUUID()}.bin`;
  const path = assetPath(key);
  await mkdir(resolve(getServerEnvironment().PRIVATE_ASSET_PATH, "ai"), {
    recursive: true,
    mode: 0o700,
  });
  await writeFile(path, bytes, { mode: 0o600, flag: "wx" });
  return key;
}
export const readAiAsset = (key: string) => readFile(assetPath(key));
export const removeAiAsset = async (key: string) => {
  try {
    await unlink(assetPath(key));
  } catch {
    /* An already absent orphan is harmless. */
  }
};
async function validateDocx(bytes: Buffer) {
  await new Promise<void>((resolve, reject) => {
    yauzl.fromBuffer(
      bytes,
      { lazyEntries: true, validateEntrySizes: true },
      (error, zip) => {
        if (error || !zip)
          return reject(new Error("DOCX inválido / Invalid DOCX"));
        let size = 0,
          count = 0;
        const names = new Set<string>();
        zip.on("error", reject);
        zip.on("entry", (entry) => {
          size += entry.uncompressedSize;
          count++;
          if (
            size > 20 * 1024 * 1024 ||
            count > 2000 ||
            entry.generalPurposeBitFlag & 1
          ) {
            zip.close();
            reject(new Error("DOCX excede os limites / DOCX exceeds limits"));
            return;
          }
          names.add(entry.fileName);
          zip.readEntry();
        });
        zip.on("end", () =>
          names.has("word/document.xml") && names.has("[Content_Types].xml")
            ? resolve()
            : reject(new Error("Invalid DOCX")),
        );
        zip.readEntry();
      },
    );
  });
}
export async function extractAiFile(
  name: string,
  bytes: Buffer,
  vision: boolean,
) {
  if (
    !bytes.length ||
    bytes.length > AI_FILE_BYTES ||
    name.length > 180 ||
    /[\x00-\x1f/\\]/.test(name)
  )
    throw new Error(
      "Arquivo inválido; limite de 10 MB. / Invalid file; 10 MB limit.",
    );
  const extension = name.split(".").at(-1)?.toLowerCase();
  let text = "",
    mime = "",
    image = false;
  if (["txt", "md", "markdown"].includes(extension ?? "")) {
    text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    if (text.includes("\0")) throw new Error("Invalid text");
    mime = extension === "txt" ? "text/plain" : "text/markdown";
  } else if (
    extension === "pdf" &&
    bytes.subarray(0, 5).toString() === "%PDF-"
  ) {
    const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
    const task = pdfjs.getDocument({
      data: new Uint8Array(bytes),
      isEvalSupported: false,
      disableFontFace: true,
      useSystemFonts: false,
      useWorkerFetch: false,
    });
    try {
      const pdf = await task.promise;
      if (pdf.numPages > 50)
        throw new Error("PDF: máximo de 50 páginas / PDF: maximum 50 pages");
      for (
        let page = 1;
        page <= pdf.numPages && text.length <= AI_TEXT_LIMIT;
        page++
      ) {
        const item = await pdf.getPage(page);
        const content = await item.getTextContent();
        text +=
          content.items.map((i) => ("str" in i ? i.str : "")).join(" ") + "\n";
        item.cleanup();
      }
      mime = "application/pdf";
    } finally {
      await task.destroy();
    }
  } else if (extension === "docx") {
    await validateDocx(bytes);
    const mammoth = await import("mammoth");
    text = (await mammoth.extractRawText({ buffer: bytes })).value;
    mime =
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  } else if (["png", "jpg", "jpeg", "webp"].includes(extension ?? "")) {
    if (!vision)
      throw new Error(
        "Este modelo não aceita imagens. / This model does not accept images.",
      );
    const metadata = await sharp(bytes, {
      limitInputPixels: 16_000_000,
    }).metadata();
    if (
      !["png", "jpeg", "webp"].includes(metadata.format ?? "") ||
      (metadata.pages ?? 1) > 1
    )
      throw new Error(
        "Use PNG, JPEG ou WebP estático. / Use a static PNG, JPEG or WebP.",
      );
    bytes = await sharp(bytes, { limitInputPixels: 16_000_000 })
      .rotate()
      .resize({
        width: 2048,
        height: 2048,
        fit: "inside",
        withoutEnlargement: true,
      })
      .webp({ quality: 85 })
      .toBuffer();
    mime = "image/webp";
    image = true;
  } else
    throw new Error(
      "Use PDF, DOCX, TXT, Markdown, PNG, JPEG ou WebP. / Unsupported file format.",
    );
  return {
    text: text.slice(0, AI_TEXT_LIMIT),
    truncated: text.length > AI_TEXT_LIMIT,
    mime,
    image,
    bytes,
  };
}
