import { NextRequest, NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/authorization";
import { isSameOriginRequest } from "@/lib/request-security";
import { getUserProfile } from "@/lib/profile";
import { getServerEnvironment } from "@/lib/env";
import {
  allowSuggestionRequest,
  getAutocompletePolicy,
  requestSuggestions,
  suggestionQuerySchema,
} from "@/lib/search-suggestions";

export const dynamic = "force-dynamic";
const json = (body: unknown, status = 200) =>
  NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "private, no-store" },
  });
export async function POST(request: NextRequest) {
  if (!isSameOriginRequest(request)) return json({ suggestions: [] }, 403);
  const session = await getCurrentSession();
  if (!session) return json({ suggestions: [] }, 401);
  const policy = getAutocompletePolicy();
  if (!policy.available) return json({ available: false, suggestions: [] });
  if (Number(request.headers.get("content-length") ?? 0) > 1024)
    return json({ suggestions: [] }, 413);
  try {
    // Read a bounded body even when content-length is absent.
    const reader = request.body?.getReader();
    if (!reader) return json({ suggestions: [] }, 400);
    let text = "",
      size = 0;
    const decoder = new TextDecoder();
    try {
      for (;;) {
        const part = await reader.read();
        if (part.done) break;
        size += part.value.length;
        if (size > 1024) return json({ suggestions: [] }, 413);
        text += decoder.decode(part.value, { stream: true });
      }
      text += decoder.decode();
    } finally {
      await reader.cancel().catch(() => undefined);
    }
    const parsed = JSON.parse(text) as { q?: unknown };
    if (!parsed || typeof parsed !== "object")
      return json({ suggestions: [] }, 400);
    const query = suggestionQuerySchema.safeParse(parsed.q);
    if (!query.success) return json({ suggestions: [] }, 400);
    if (!allowSuggestionRequest(session.user.id))
      return json({ suggestions: [] }, 429);
    const suggestions = await requestSuggestions(
      query.data,
      getUserProfile(session.user.id).locale,
      getServerEnvironment().HOME_AUTOCOMPLETE_BRAVE_API_KEY!,
    );
    return json({ available: true, suggestions });
  } catch {
    return json({ available: false, suggestions: [] }, 503);
  }
}
