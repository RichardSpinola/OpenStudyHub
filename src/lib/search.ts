import type { Appearance } from "@/lib/appearance";

const engines: Record<
  Appearance["searchEngine"],
  { url: string; parameter: string }
> = {
  google: { url: "https://www.google.com/search", parameter: "q" },
  scholar: { url: "https://scholar.google.com/scholar", parameter: "q" },
  duckduckgo: { url: "https://duckduckgo.com/", parameter: "q" },
  startpage: { url: "https://www.startpage.com/sp/search", parameter: "query" },
  ecosia: { url: "https://www.ecosia.org/search", parameter: "q" },
};

export function buildWebSearchUrl(
  query: string,
  engine: Appearance["searchEngine"] = "google",
): URL | null {
  const normalizedQuery = query.trim();

  if (!normalizedQuery) {
    return null;
  }

  const provider = engines[engine];
  const destination = new URL(provider.url);
  destination.searchParams.set(provider.parameter, normalizedQuery);

  return destination;
}
