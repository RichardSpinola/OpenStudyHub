/** Limit bytes even for requests without a Content-Length header. */
export async function readSmallJson(
  request: Request,
  maxBytes = 20000,
): Promise<unknown> {
  if (Number(request.headers.get("content-length")) > maxBytes)
    throw new Error("Dados grandes demais.");
  const reader = request.body?.getReader();
  if (!reader) throw new Error("Dados ausentes.");
  let size = 0;
  const chunks: Uint8Array[] = [];
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) {
        await reader.cancel();
        throw new Error("Dados grandes demais.");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const all = new Uint8Array(size);
  let offset = 0;
  for (const c of chunks) {
    all.set(c, offset);
    offset += c.length;
  }
  return JSON.parse(new TextDecoder().decode(all));
}
