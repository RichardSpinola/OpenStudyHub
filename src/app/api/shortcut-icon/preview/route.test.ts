import { describe, expect, it, vi, beforeEach } from "vitest";
const mocks = vi.hoisted(() => ({
  session: vi.fn(),
  admin: vi.fn(),
  icon: vi.fn(),
}));
vi.mock("@/lib/authorization", () => ({ getCurrentSession: mocks.session }));
vi.mock("@/lib/v2/runtime", () => ({
  currentAdminV2: mocks.admin,
  withV2DbAsync: async (fn: () => unknown) => fn(),
}));
vi.mock("@/lib/shortcut-icons", () => ({ fetchShortcutIcon: mocks.icon }));
vi.mock("@/lib/request-security", () => ({ isSameOriginRequest: () => false }));
import { POST } from "./route";
function request(
  origin = "http://127.0.0.1:3091",
  body = JSON.stringify({ url: "https://github.com" }),
) {
  return new Request("http://localhost:3091/control/shortcut-icon-preview", {
    method: "POST",
    headers: {
      origin,
      host: "127.0.0.1:3091",
      "content-type": "application/json",
    },
    body,
  });
}
beforeEach(() => {
  vi.stubEnv("OPENSTUDYHUB_V2_ENABLED", "1");
  mocks.session.mockResolvedValue(null);
  mocks.admin.mockResolvedValue({ mustChangePassword: false });
  mocks.icon.mockResolvedValue(Buffer.from("fake-image"));
});
describe("shortcut preview origin and authentication", () => {
  it("accepts the visible Admin origin despite Next's internal listener URL", async () => {
    const r = await POST(request());
    expect(r.status).toBe(200);
    expect((await r.json()).image).toMatch(/^data:image\/png;base64,/);
  });
  it("rejects another origin", async () => {
    expect((await POST(request("https://attacker.example"))).status).toBe(403);
  });
  it("requires a valid session", async () => {
    mocks.admin.mockResolvedValue(null);
    expect((await POST(request())).status).toBe(401);
  });
  it("requires a completed password change", async () => {
    mocks.admin.mockResolvedValue({ mustChangePassword: true });
    expect((await POST(request())).status).toBe(401);
  });
  it("reports an unavailable icon separately from an invalid URL", async () => {
    mocks.icon.mockResolvedValue(null);
    expect(await (await POST(request())).json()).toEqual({ image: null });
    expect(
      (await POST(request(undefined, JSON.stringify({ url: 42 })))).status,
    ).toBe(400);
  });
});
