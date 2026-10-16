import { it, expect, vi } from "vitest";
const admin = vi.hoisted(() => vi.fn());
vi.mock("./runtime", () => ({
  currentAdminV2: admin,
  withV2DbAsync: async (fn: (db: unknown) => unknown) => fn({}),
}));
import { GET } from "@/app/control/system/backup/[id]/route";
it("blocks backup download without an independent valid Admin session or while a password change is pending", async () => {
  const context = {
    params: Promise.resolve({ id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" }),
  };
  admin.mockResolvedValue(null);
  expect(
    (
      await GET(
        new Request("http://localhost/control/system/backup/test"),
        context,
      )
    ).status,
  ).toBe(403);
  admin.mockResolvedValue({ mustChangePassword: true });
  expect(
    (
      await GET(
        new Request("http://localhost/control/system/backup/test"),
        context,
      )
    ).status,
  ).toBe(403);
});
