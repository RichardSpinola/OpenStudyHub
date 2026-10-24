import { aiUser, aiHeaders, aiError } from "@/lib/ai/http";
import { cancelAiRequest } from "@/lib/ai/generation";
export async function POST(request: Request) {
  try {
    const user = await aiUser(request, true);
    const input = await request.json();
    if (typeof input.id !== "string" || input.id.length > 100)
      throw new Error();
    cancelAiRequest(user.id, input.id);
    return Response.json({ ok: true }, { headers: aiHeaders });
  } catch (error) {
    return aiError(error);
  }
}
