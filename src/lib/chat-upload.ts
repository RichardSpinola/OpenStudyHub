export const chatImageLimitBytes = 5 * 1024 * 1024;
export const chatFileLimitBytes = 20 * 1024 * 1024;
export const chatRequestLimitBytes = chatFileLimitBytes + 64 * 1024;
export function isChatImageName(name: string) {
  return /\.(png|jpe?g|webp)$/iu.test(name);
}
export function validChatFilename(name: string) {
  return (
    name.length > 0 &&
    name.length <= 180 &&
    !/[\x00-\x1f\x7f/\\]/u.test(name) &&
    name !== "." &&
    name !== ".."
  );
}
export async function readChatFormData(request: Request) {
  const declared = Number(request.headers.get("content-length"));
  if (declared > chatRequestLimitBytes) throw new Error("Envio grande demais.");
  const reader = request.body?.getReader();
  if (!reader) throw new Error("Envio vazio.");
  const chunks: Uint8Array<ArrayBuffer>[] = [];
  let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > chatRequestLimitBytes) {
        await reader.cancel();
        throw new Error("Envio grande demais.");
      }
      chunks.push(new Uint8Array(value));
    }
  } finally {
    reader.releaseLock();
  }
  return new Response(new Blob(chunks), {
    headers: { "content-type": request.headers.get("content-type") ?? "" },
  }).formData();
}
