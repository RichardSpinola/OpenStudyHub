import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { getCurrentSession } from "@/lib/authorization";
import { completeGoogleAuthorization } from "@/lib/google/oauth";

import { GET } from "./route";

vi.mock("@/lib/authorization", () => ({ getCurrentSession: vi.fn() }));
vi.mock("@/lib/google/oauth", () => ({
  completeGoogleAuthorization: vi.fn(),
}));

describe("Google OAuth callback", () => {
  beforeEach(() => vi.clearAllMocks());

  it("exige sessão local ativa", async () => {
    vi.mocked(getCurrentSession).mockResolvedValue(null);
    const response = await GET(
      new NextRequest(
        "http://localhost:3000/api/google/callback?code=code&state=state",
      ),
    );
    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe(
      "http://localhost:3000/login",
    );
    expect(completeGoogleAuthorization).not.toHaveBeenCalled();
  });

  it("conclui para o usuário da sessão sem refletir erros do provedor", async () => {
    vi.mocked(getCurrentSession).mockResolvedValue({
      id: 1,
      expiresAt: Date.now() + 60_000,
      user: {
        id: 42,
        displayName: "User",
        login: "user",
        role: "member",
      },
    });
    const response = await GET(
      new NextRequest(
        "http://localhost:3000/api/google/callback?code=private-code&state=private-state",
      ),
    );
    expect(completeGoogleAuthorization).toHaveBeenCalledWith(
      42,
      "private-code",
      "private-state",
    );
    expect(response.headers.get("location")).toBe(
      "http://localhost:3000/settings?google=connected",
    );

    const denied = await GET(
      new NextRequest(
        "http://localhost:3000/api/google/callback?error=access_denied&error_description=private-provider-detail",
      ),
    );
    expect(denied.headers.get("location")).toBe(
      "http://localhost:3000/settings?google=cancelled",
    );
    expect(denied.headers.get("location")).not.toContain(
      "private-provider-detail",
    );
  });
});
