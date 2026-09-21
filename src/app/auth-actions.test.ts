import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  audit: vi.fn(),
  clearCookie: vi.fn(),
  getSession: vi.fn(),
  readCookie: vi.fn(),
  redirect: vi.fn(),
  revokeSession: vi.fn(),
}));

vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("@/lib/audit", () => ({ recordAuditEvent: mocks.audit }));
vi.mock("@/lib/session", () => ({
  getSessionByToken: mocks.getSession,
  revokeSessionToken: mocks.revokeSession,
}));
vi.mock("@/lib/session-cookie", () => ({
  clearSessionCookie: mocks.clearCookie,
  readSessionCookie: mocks.readCookie,
}));

import { logoutAction } from "./auth-actions";

describe("logoutAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.readCookie.mockResolvedValue("synthetic-session-token");
    mocks.getSession.mockReturnValue({
      id: 7,
      user: {
        id: 3,
        displayName: "Pessoa Teste",
        login: "pessoa.teste",
        role: "member",
      },
      expiresAt: 1_900_000_000_000,
    });
    mocks.revokeSession.mockReturnValue(true);
    mocks.clearCookie.mockResolvedValue(undefined);
    mocks.redirect.mockImplementation(() => {
      throw new Error("redirect:/login");
    });
  });

  it("revoga e limpa a sessão mesmo quando a auditoria falha", async () => {
    mocks.audit.mockImplementation(() => {
      throw new Error("audit unavailable");
    });

    await expect(logoutAction()).rejects.toThrow("redirect:/login");

    expect(mocks.revokeSession).toHaveBeenCalledWith("synthetic-session-token");
    expect(mocks.audit).toHaveBeenCalledOnce();
    expect(mocks.clearCookie).toHaveBeenCalledOnce();
    expect(mocks.revokeSession.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.audit.mock.invocationCallOrder[0],
    );
    expect(mocks.audit.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.clearCookie.mock.invocationCallOrder[0],
    );
  });

  it("permanece idempotente quando não há cookie de sessão", async () => {
    mocks.readCookie.mockResolvedValue(null);

    await expect(logoutAction()).rejects.toThrow("redirect:/login");

    expect(mocks.getSession).not.toHaveBeenCalled();
    expect(mocks.revokeSession).not.toHaveBeenCalled();
    expect(mocks.audit).not.toHaveBeenCalled();
    expect(mocks.clearCookie).toHaveBeenCalledOnce();
  });
});
