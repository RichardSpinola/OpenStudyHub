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
export async function readBoundedFormData(request: Request, limit: number) {
  const declared = Number(request.headers.get("content-length"));
  if (declared > limit) throw new Error("Envio grande demais.");
  const reader = request.body?.getReader();
  if (!reader) throw new Error("Envio vazio.");
  let size = 0;
  const counted = new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        const { done, value } = await reader.read();
        if (done) {
          controller.close();
          return;
        }
        size += value.byteLength;
        if (size > limit) {
          await reader.cancel();
          controller.error(new Error("Envio grande demais."));
          return;
        }
        controller.enqueue(value);
      } catch (error) {
        controller.error(error);
      }
    },
    cancel(reason) {
      return reader.cancel(reason);
    },
  });
  try {
    return await new Response(counted, {
      headers: { "content-type": request.headers.get("content-type") ?? "" },
    }).formData();
  } finally {
    await reader.cancel().catch(() => undefined);
    reader.releaseLock();
  }
}
export function readChatFormData(request: Request) {
  return readBoundedFormData(request, chatRequestLimitBytes);
}
