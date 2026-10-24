import { claimAiUpload } from "@/lib/ai/upload-lease";
import { after } from "next/server";
import { aiUser, aiHeaders, aiError } from "@/lib/ai/http";
import { prepareRequest, runAiRequest, requireAi } from "@/lib/ai/generation";
export const dynamic = "force-dynamic";
export const maxDuration = 600;
export async function POST(request: Request) {
  let release: (() => unknown) | undefined;
  try {
    const user = await aiUser(request, true);
    requireAi();
    release = claimAiUpload(user.id);
    const length = Number(request.headers.get("content-length"));
    if (!Number.isFinite(length) || length > 41 * 1024 * 1024)
      throw new Error(
        "Máximo de quatro arquivos de 10 MB / Maximum four files of 10 MB",
      );
    // Next's self-hosted proxy also enforces a body limit; check the streamed body before buffering multipart.
    const reader = request.body?.getReader();
    if (!reader) throw new Error();
    const chunks: Uint8Array[] = [];
    let size = 0;
    const deadline = setTimeout(() => {
      void reader.cancel();
    }, 30000);
    let uploadComplete = false;
    try {
      while (true) {
        const item = await reader.read();
        if (item.done) {
          uploadComplete = true;
          break;
        }
        size += item.value.length;
        if (size > 41 * 1024 * 1024) {
          await reader.cancel();
          throw new Error("Upload excede o limite / Upload exceeds limit");
        }
        chunks.push(item.value);
      }
    } finally {
      clearTimeout(deadline);
    }
    if (!uploadComplete)
      throw new Error("Tempo de envio excedido / Upload timeout");
    const form = await new Response(new Blob(chunks as BlobPart[]), {
      headers: { "Content-Type": request.headers.get("content-type") ?? "" },
    }).formData();
    const files = form.getAll("file");
    if (files.some((f) => !(f instanceof File))) throw new Error();
    const refs = JSON.parse(String(form.get("sources") ?? "[]"));
    if (!Array.isArray(refs)) throw new Error();
    const result = await prepareRequest(
      user.id,
      String(form.get("conversation") ?? ""),
      String(form.get("content") ?? ""),
      refs,
      files as File[],
    );
    after(async () => {
      await runAiRequest(result.requestId);
    });
    return Response.json(result, { headers: aiHeaders });
  } catch (error) {
    return aiError(error);
  } finally {
    release?.();
  }
}
