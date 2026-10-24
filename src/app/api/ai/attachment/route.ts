import { aiUser, aiHeaders, aiError } from "@/lib/ai/http";
import { getDatabase } from "@/lib/db/client";
import { getConversation, type AiSource } from "@/lib/ai/conversations";
import { readAiAsset } from "@/lib/ai/files";
export async function GET(request: Request) {
  try {
    const user = await aiUser(request),
      id = new URL(request.url).searchParams.get("id");
    const source = getDatabase()
      .sqlite.prepare("SELECT * FROM ai_sources WHERE id=?")
      .get(id) as (AiSource & { conversation_id: string }) | undefined;
    if (!source?.asset_key) throw new Error();
    getConversation(user.id, source.conversation_id);
    const bytes = await readAiAsset(source.asset_key);
    getConversation(user.id, source.conversation_id);
    return new Response(new Uint8Array(bytes), {
      headers: {
        ...aiHeaders,
        "Content-Type": source.mime ?? "application/octet-stream",
        "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(source.title)}`,
        "Content-Security-Policy": "default-src 'none'; sandbox",
      },
    });
  } catch (error) {
    return aiError(error);
  }
}
