import { expect, it } from "vitest";
import sharp from "sharp";
import { faviconImage } from "./favicon-image";
it("decodes the common 32-bit ICO format to a bounded PNG", async () => {
  const width = 16,
    height = 16;
  const dib = Buffer.alloc(40 + width * height * 4 + 4 * height);
  dib.writeUInt32LE(40, 0);
  dib.writeInt32LE(width, 4);
  dib.writeInt32LE(height * 2, 8);
  dib.writeUInt16LE(1, 12);
  dib.writeUInt16LE(32, 14);
  for (let i = 0; i < width * height; i++) {
    dib[40 + i * 4 + 2] = 255;
    dib[40 + i * 4 + 3] = 255;
  }
  const ico = Buffer.alloc(22 + dib.length);
  ico.writeUInt16LE(1, 2);
  ico.writeUInt16LE(1, 4);
  ico[6] = width;
  ico[7] = height;
  ico.writeUInt32LE(dib.length, 14);
  ico.writeUInt32LE(22, 18);
  dib.copy(ico, 22);
  const png = await faviconImage(ico);
  expect((await sharp(png).metadata()).format).toBe("png");
  expect((await sharp(png).metadata()).width).toBe(64);
});
it("accepts PNG embedded in ICO and rejects invalid oversized frames", async () => {
  const png = await sharp({
    create: { width: 16, height: 16, channels: 4, background: "#ff0000" },
  })
    .png()
    .toBuffer();
  const ico = Buffer.alloc(png.length + 22);
  ico.writeUInt16LE(1, 2);
  ico.writeUInt16LE(1, 4);
  ico[6] = 16;
  ico[7] = 16;
  ico.writeUInt32LE(png.length, 14);
  ico.writeUInt32LE(22, 18);
  png.copy(ico, 22);
  expect((await sharp(await faviconImage(ico)).metadata()).width).toBe(64);
  ico.writeUInt32LE(100000000, 14);
  await expect(faviconImage(ico)).rejects.toThrow();
});
