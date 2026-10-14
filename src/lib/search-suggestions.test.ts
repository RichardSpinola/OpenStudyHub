import { describe, expect, it, vi } from "vitest";
import {
  requestSuggestions,
  suggestionQuerySchema,
  allowSuggestionRequest,
  getAutocompletePolicy,
  setAutocompletePolicy,
} from "./search-suggestions";
import { createMigratedTestDatabase } from "./test-database";

describe("real Home suggestions", () => {
  it("uses only the official HTTPS endpoint, server-side key and normalized results", async () => {
    const fetcher = vi.fn(async () =>
      Response.json({
        results: [
          { query: "  cálculo integral " },
          { query: "cálculo integral" },
          { query: "cálculo" },
          { query: "álgebra" },
        ],
      }),
    );
    expect(
      await requestSuggestions("cálculo", "pt-BR", "fake-test-key", fetcher),
    ).toEqual(["cálculo integral", "álgebra"]);
    const [url, options] = fetcher.mock.calls[0] as unknown as [
      URL,
      RequestInit,
    ];
    expect(url.origin).toBe("https://api.search.brave.com");
    expect(url.pathname).toBe("/res/v1/suggest/search");
    expect(url.searchParams.get("q")).toBe("cálculo");
    expect(url.searchParams.get("country")).toBe("BR");
    expect(url.toString()).not.toContain("fake-test-key");
    expect(options.headers).toHaveProperty(
      "X-Subscription-Token",
      "fake-test-key",
    );
    expect(options.cache).toBe("no-store");
    expect(options.redirect).toBe("error");
  });
  it("has no fabricated fallback for provider failure or malformed/oversized data", async () => {
    for (const response of [
      new Response(null, { status: 429 }),
      Response.json({ results: [{ url: "https://example.com" }] }),
      new Response("x".repeat(32769)),
    ])
      await expect(
        requestSuggestions("test", "en", "fake", async () => response),
      ).rejects.toThrow();
    expect(suggestionQuerySchema.safeParse("a").success).toBe(false);
    expect(suggestionQuerySchema.safeParse("x".repeat(161)).success).toBe(
      false,
    );
  });
  it("bounds request rate without mixing account budgets", () => {
    expect(allowSuggestionRequest(9101, 100000)).toBe(true);
    expect(allowSuggestionRequest(9101, 100100)).toBe(false);
    expect(allowSuggestionRequest(9102, 100100)).toBe(true);
    for (let i = 1; i < 40; i++)
      expect(allowSuggestionRequest(9101, 100000 + i * 400)).toBe(true);
    expect(allowSuggestionRequest(9101, 120000)).toBe(false);
    expect(allowSuggestionRequest(9101, 180000)).toBe(true);
  });
  it("defaults to no external autocomplete until the administrator enables it", () => {
    const db = createMigratedTestDatabase();
    try {
      expect(getAutocompletePolicy(db).enabled).toBe(false);
      setAutocompletePolicy(true, db);
      expect(getAutocompletePolicy(db).enabled).toBe(true);
      setAutocompletePolicy(false, db);
      expect(getAutocompletePolicy(db).available).toBe(false);
    } finally {
      db.close();
    }
  });
});
