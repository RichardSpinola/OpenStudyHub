const GOOGLE_SEARCH_ENDPOINT = "https://www.google.com/search";

export function buildWebSearchUrl(query: string): URL | null {
  const normalizedQuery = query.trim();

  if (!normalizedQuery) {
    return null;
  }

  const destination = new URL(GOOGLE_SEARCH_ENDPOINT);
  destination.searchParams.set("q", normalizedQuery);

  return destination;
}
