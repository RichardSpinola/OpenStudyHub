import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const mocks = vi.hoisted(() => ({
  session: vi.fn(),
  sameOrigin: vi.fn(),
  policy: vi.fn(),
  allow: vi.fn(),
  provider: vi.fn(),
}));
vi.mock("@/lib/authorization", () => ({ getCurrentSession: mocks.session }));
vi.mock("@/lib/request-security", () => ({
  isSameOriginRequest: mocks.sameOrigin,
}));
vi.mock("@/lib/profile", () => ({
  getUserProfile: () => ({ locale: "pt-BR" }),
}));
vi.mock("@/lib/env", () => ({
  getServerEnvironment: () => ({
    HOME_AUTOCOMPLETE_BRAVE_API_KEY: "fake-server-only-key",
  }),
}));
vi.mock("@/lib/search-suggestions", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/search-suggestions")>()),
  getAutocompletePolicy: mocks.policy,
  allowSuggestionRequest: mocks.allow,
  requestSuggestions: mocks.provider,
}));
import { POST } from "./route";
const request = (body = JSON.stringify({ q: "algoritmos" })) =>
  new NextRequest("http://localhost:3000/api/home-search/suggestions", {
    method: "POST",
    headers: {
      origin: "http://localhost:3000",
      "Content-Type": "application/json",
    },
    body,
  });
beforeEach(() => {
  vi.clearAllMocks();
  mocks.sameOrigin.mockReturnValue(true);
  mocks.session.mockResolvedValue({ user: { id: 7 } });
  mocks.policy.mockReturnValue({ available: true });
  mocks.allow.mockReturnValue(true);
  mocks.provider.mockResolvedValue(["algoritmos exemplos"]);
});
describe("autocomplete authorization and fallback", () => {
  it("never sends text without session, origin or configured policy", async () => {
    mocks.sameOrigin.mockReturnValue(false);
    expect((await POST(request())).status).toBe(403);
    expect(mocks.provider).not.toHaveBeenCalled();
    mocks.sameOrigin.mockReturnValue(true);
    mocks.session.mockResolvedValue(null);
    expect((await POST(request())).status).toBe(401);
    mocks.session.mockResolvedValue({ user: { id: 7 } });
    mocks.policy.mockReturnValue({ available: false });
    expect(await (await POST(request())).json()).toEqual({
      available: false,
      suggestions: [],
    });
    expect(mocks.provider).not.toHaveBeenCalled();
  });
  it("rejects malformed, oversized and over-budget requests before contacting the provider", async () => {
    expect((await POST(request("null"))).status).toBe(400);
    expect((await POST(request('{"q":"x"}'))).status).toBe(400);
    expect((await POST(request("x".repeat(1025)))).status).toBe(413);
    mocks.allow.mockReturnValue(false);
    expect((await POST(request())).status).toBe(429);
    expect(mocks.provider).not.toHaveBeenCalled();
  });
  it("returns only suggestions with private no-store caching and no server key", async () => {
    const response = await POST(request());
    const body = await response.text();
    expect(body).toContain("algoritmos exemplos");
    expect(body).not.toContain("fake-server-only-key");
    expect(response.headers.get("Cache-Control")).toContain("no-store");
    mocks.provider.mockRejectedValue(new Error("provider unavailable"));
    expect((await POST(request())).status).toBe(503);
  });
});
