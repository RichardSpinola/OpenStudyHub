import { expect, it } from "vitest";
import yazl from "yazl";
import sharp from "sharp";
import { extractIsolated } from "./extract-isolated";
function pdf(pages: number) {
  const objects: string[] = [];
  objects.push(
    "<< /Type /Catalog /Pages 2 0 R /OpenAction << /S /JavaScript /JS (throw new Error('must never execute')) >> >>",
  );
  objects.push(
    `<< /Type /Pages /Count ${pages} /Kids [${Array.from({ length: pages }, (_, i) => `${4 + i * 2} 0 R`).join(" ")}] >>`,
  );
  objects.push("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");
  for (let i = 0; i < pages; i++) {
    objects.push(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 300] /Resources << /Font << /F1 3 0 R >> >> /Contents ${5 + i * 2} 0 R >>`,
    );
    const content = "BT /F1 12 Tf 20 250 Td (Hello selected PDF) Tj ET";
    objects.push(
      `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
    );
  }
  let output = "%PDF-1.4\n";
  const offsets = [0];
  for (const [i, obj] of objects.entries()) {
    offsets.push(Buffer.byteLength(output));
    output += `${i + 1} 0 obj\n${obj}\nendobj\n`;
  }
  const xref = Buffer.byteLength(output);
  output += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets
    .slice(1)
    .map((n) => `${String(n).padStart(10, "0")} 00000 n \n`)
    .join(
      "",
    )}trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return Buffer.from(output);
}
async function docx() {
  const zip = new yazl.ZipFile();
  zip.addBuffer(
    Buffer.from(
      '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>',
    ),
    "[Content_Types].xml",
  );
  zip.addBuffer(
    Buffer.from(
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>',
    ),
    "_rels/.rels",
  );
  zip.addBuffer(
    Buffer.from(
      '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>Selected DOCX text</w:t></w:r></w:p></w:body></w:document>',
    ),
    "word/document.xml",
  );
  const chunks: Buffer[] = [];
  const result = new Promise<Buffer>((resolve, reject) => {
    zip.outputStream.on("data", (chunk) => chunks.push(chunk));
    zip.outputStream.on("end", () => resolve(Buffer.concat(chunks)));
    zip.outputStream.on("error", reject);
  });
  zip.end();
  return result;
}
it("extracts PDF text in an isolated process without executing document JavaScript and rejects more than 50 pages", async () => {
  const result = await extractIsolated("selected.pdf", pdf(1), false);
  expect(result.text).toContain("Hello selected PDF");
  await expect(
    extractIsolated("too-many.pdf", pdf(51), false),
  ).rejects.toThrow();
}, 30000);
it("extracts a DOCX without HTML rendering and normalizes a static image only for a vision model", async () => {
  const result = await extractIsolated("study.docx", await docx(), false);
  expect(result.text).toContain("Selected DOCX text");
  const png = await sharp({
    create: { width: 8, height: 8, channels: 3, background: "white" },
  })
    .png()
    .toBuffer();
  await expect(extractIsolated("image.png", png, false)).rejects.toThrow();
  const image = await extractIsolated("image.png", png, true);
  expect(image.mime).toBe("image/webp");
  expect(image.image).toBe(true);
  expect((await sharp(image.bytes).metadata()).width).toBe(8);
}, 30000);
