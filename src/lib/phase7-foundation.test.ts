import { PassThrough } from "node:stream";

import yazl from "yazl";
import { describe, expect, it, vi } from "vitest";

import { validateDocxPackage } from "./docx-template-import";
import { parseExternalDocumentationUrl } from "./external-documentation";
import { discoverShortcutIcon } from "./shortcut-icons";

async function docxBuffer(): Promise<Buffer> {
  const archive = new yazl.ZipFile();
  archive.addBuffer(Buffer.from("<Types/>"), "[Content_Types].xml");
  archive.addBuffer(Buffer.from("<document/>"), "word/document.xml");
  archive.end();
  const stream = new PassThrough();
  const chunks: Buffer[] = [];
  archive.outputStream.pipe(stream);
  stream.on("data", (chunk: Buffer) => chunks.push(chunk));
  await new Promise<void>((resolve, reject) => {
    stream.on("end", resolve);
    stream.on("error", reject);
  });
  return Buffer.concat(chunks);
}

describe("Phase 7 safety foundations", () => {
  it("validates actual OOXML structure", async () => {
    await expect(
      validateDocxPackage(await docxBuffer()),
    ).resolves.toBeUndefined();
    await expect(validateDocxPackage(Buffer.from("not-a-zip"))).rejects.toThrow(
      "Invalid DOCX package",
    );
  });

  it("rejects unsafe external documentation schemes", () => {
    expect(parseExternalDocumentationUrl("https://docs.example.test/")).toBe(
      "https://docs.example.test/",
    );
    expect(() =>
      parseExternalDocumentationUrl("javascript:alert(1)"),
    ).toThrow();
    expect(() =>
      parseExternalDocumentationUrl("http://example.test"),
    ).toThrow();
  });

  it("blocks shortcut icon SSRF before fetch", async () => {
    const fetchImpl = vi.fn<typeof fetch>();
    await expect(
      discoverShortcutIcon("user", 1, 1, "http://127.0.0.1/private", {
        fetchImpl,
      }),
    ).resolves.toBe(false);
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
