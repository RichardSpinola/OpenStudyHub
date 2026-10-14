import { z } from "zod";
import { getDatabase, type DatabaseConnection } from "./db/client";
import { getServerEnvironment } from "./env";

const setting = "home.autocomplete.enabled";
export function getAutocompletePolicy(
  connection: DatabaseConnection = getDatabase(),
) {
  const row = connection.sqlite
    .prepare("SELECT value FROM app_settings WHERE key=?")
    .get(setting) as { value: string } | undefined;
  const enabled = row?.value === "true";
  return {
    enabled,
    available:
      enabled &&
      Boolean(getServerEnvironment().HOME_AUTOCOMPLETE_BRAVE_API_KEY),
  };
}
export function setAutocompletePolicy(
  enabled: boolean,
  connection: DatabaseConnection = getDatabase(),
) {
  connection.sqlite
    .prepare(
      `INSERT INTO app_settings(key,value,updated_at) VALUES(?,?,?)
    ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=excluded.updated_at`,
    )
    .run(setting, String(enabled), Date.now());
}
export const suggestionQuerySchema = z
  .string()
  .trim()
  .min(2)
  .max(160)
  .refine((q) => q.split(/\s+/u).length <= 50);
const payloadSchema = z.object({
  results: z.array(z.object({ query: z.string().max(400) })).max(50),
});
export async function requestSuggestions(
  query: string,
  language: string,
  apiKey: string,
  fetchImpl: typeof fetch = fetch,
): Promise<string[]> {
  const q = suggestionQuerySchema.parse(query);
  const endpoint = new URL(
    "https://api.search.brave.com/res/v1/suggest/search",
  );
  endpoint.search = new URLSearchParams({
    q,
    lang: language === "pt-BR" ? "pt" : "en",
    country: language === "pt-BR" ? "BR" : "US",
    count: "6",
  }).toString();
  const response = await fetchImpl(endpoint, {
    headers: { Accept: "application/json", "X-Subscription-Token": apiKey },
    signal: AbortSignal.timeout(2200),
    cache: "no-store",
    redirect: "error",
  });
  if (!response.ok || !response.body)
    throw new Error("Suggestions unavailable.");
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 32 * 1024) throw new Error("Suggestions response too large.");
      chunks.push(value);
    }
  } finally {
    await reader.cancel().catch(() => undefined);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  const payload = payloadSchema.parse(
    JSON.parse(new TextDecoder().decode(bytes)),
  );
  return [
    ...new Set(
      payload.results
        .map((result) => result.query.trim())
        .filter((text) => text && text.length <= 160 && text !== q),
    ),
  ].slice(0, 6);
}
// Bounded per-process budget. Queries and credentials are never stored here.
const budgets = new Map<number, number[]>();
export function allowSuggestionRequest(
  userId: number,
  now = Date.now(),
): boolean {
  for (const [id, timestamps] of budgets)
    if ((timestamps.at(-1) ?? 0) < now - 60_000) budgets.delete(id);
  const recent = (budgets.get(userId) ?? []).filter(
    (time) => time > now - 60_000,
  );
  if (recent.length >= 40 || (recent.length > 0 && now - recent.at(-1)! < 300))
    return false;
  if (!budgets.has(userId) && budgets.size >= 1000) return false;
  recent.push(now);
  budgets.set(userId, recent);
  return true;
}
