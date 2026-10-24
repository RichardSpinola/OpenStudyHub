import { aiUser, aiHeaders, aiError } from "@/lib/ai/http";
import { getDatabase } from "@/lib/db/client";
import { getConversation } from "@/lib/ai/conversations";
export const dynamic = "force-dynamic";
export const maxDuration = 600;
export async function GET(request: Request) {
  try {
    const user = await aiUser(request),
      id = new URL(request.url).searchParams.get("request");
    const db = getDatabase();
    const row = db.sqlite
      .prepare("SELECT conversation_id,user_id FROM ai_requests WHERE id=?")
      .get(id) as { conversation_id: string; user_id: number } | undefined;
    if (!row) throw new Error();
    getConversation(user.id, row.conversation_id);
    let stopped = false;
    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();
        let previous = "",
          elapsed = 0;
        try {
          while (!stopped && !request.signal.aborted && elapsed < 600_000) {
            getConversation(user.id, row.conversation_id);
            const live = db.sqlite
              .prepare(
                "SELECT r.status,m.content,m.id FROM ai_requests r JOIN ai_messages m ON m.id=r.assistant_message_id WHERE r.id=?",
              )
              .get(id) as
              { status: string; content: string; id: string } | undefined;
            if (!live) break;
            const json = JSON.stringify(live);
            if (json !== previous) {
              controller.enqueue(encoder.encode(`data: ${json}\n\n`));
              previous = json;
            }
            if (!["queued", "running"].includes(live.status)) break;
            await new Promise((resolve) => setTimeout(resolve, 250));
            elapsed += 250;
          }
        } catch {
          if (!stopped)
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({ status: "error", error: "Acesso encerrado / Access ended" })}\n\n`,
              ),
            );
        } finally {
          if (!stopped) {
            stopped = true;
            controller.close();
          }
        }
      },
      cancel() {
        stopped = true;
      },
    });
    return new Response(stream, {
      headers: {
        ...aiHeaders,
        "Content-Type": "text/event-stream",
        "X-Accel-Buffering": "no",
      },
    });
  } catch (error) {
    return aiError(error);
  }
}
