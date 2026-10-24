import { aiUser, aiHeaders, aiError } from "@/lib/ai/http";
import { listSourceChoices } from "@/lib/ai/sources";
import { getDatabase } from "@/lib/db/client";
import { requireAi } from "@/lib/ai/generation";
export async function GET(request: Request) {
  try {
    const user = await aiUser(request);
    const state = requireAi();
    return Response.json(
      {
        sources: state.config.sources
          ? listSourceChoices(user.id, getDatabase())
          : [],
      },
      { headers: aiHeaders },
    );
  } catch (error) {
    return aiError(error);
  }
}
