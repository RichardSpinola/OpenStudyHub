import sharp from "sharp";
/** Decode common ICO frames into bounded PNG; sharp itself does not decode ICO. */
export async function faviconImage(data: Buffer): Promise<Buffer> {
  if (
    data.length < 22 ||
    data.readUInt16LE(0) !== 0 ||
    data.readUInt16LE(2) !== 1
  )
    return sharp(data, { limitInputPixels: 4_000_000 })
      .resize(64, 64, { fit: "contain" })
      .png()
      .toBuffer();
  const count = Math.min(data.readUInt16LE(4), 64);
  const frames: Array<{ offset: number; size: number; width: number }> = [];
  for (let i = 0; i < count; i++) {
    const at = 6 + i * 16;
    if (at + 16 > data.length) break;
    const size = data.readUInt32LE(at + 8),
      offset = data.readUInt32LE(at + 12);
    if (offset >= 6 + count * 16 && size > 0 && offset + size <= data.length)
      frames.push({ offset, size, width: data[at] || 256 });
  }
  for (const frame of frames.sort((a, b) => b.width - a.width))
    try {
      const image = data.subarray(frame.offset, frame.offset + frame.size);
      if (
        image
          .subarray(0, 8)
          .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
      )
        return await sharp(image, { limitInputPixels: 4_000_000 })
          .resize(64, 64, { fit: "contain" })
          .png()
          .toBuffer();
      if (
        image.length < 40 ||
        image.readUInt32LE(0) !== 40 ||
        image.readUInt32LE(16) !== 0
      )
        continue;
      const width = image.readInt32LE(4),
        height = Math.abs(image.readInt32LE(8)) / 2,
        bits = image.readUInt16LE(14);
      if (
        width < 1 ||
        width > 256 ||
        !Number.isInteger(height) ||
        height < 1 ||
        height > 256 ||
        ![24, 32].includes(bits)
      )
        continue;
      const stride = Math.ceil((width * bits) / 32) * 4,
        maskStride = Math.ceil(width / 32) * 4;
      if (image.length < 40 + stride * height) continue;
      const rgba = Buffer.alloc(width * height * 4);
      let anyAlpha = false;
      for (let y = 0; y < height; y++)
        for (let x = 0; x < width; x++) {
          const src = 40 + (height - y - 1) * stride + x * (bits / 8),
            dst = (y * width + x) * 4;
          rgba[dst] = image[src + 2];
          rgba[dst + 1] = image[src + 1];
          rgba[dst + 2] = image[src];
          rgba[dst + 3] = bits === 32 ? image[src + 3] : 255;
          if (bits === 32 && image[src + 3]) anyAlpha = true;
        }
      if (bits === 24 || !anyAlpha) {
        const mask = 40 + stride * height;
        for (let y = 0; y < height; y++)
          for (let x = 0; x < width; x++) {
            const pos =
              mask + (height - y - 1) * maskStride + Math.floor(x / 8);
            rgba[(y * width + x) * 4 + 3] =
              pos < image.length && image[pos] & (128 >> (x % 8)) ? 0 : 255;
          }
      }
      return await sharp(rgba, { raw: { width, height, channels: 4 } })
        .resize(64, 64, { fit: "contain" })
        .png()
        .toBuffer();
    } catch {
      /* Try the next bounded frame. */
    }
  throw new Error("Ícone não suportado.");
}
