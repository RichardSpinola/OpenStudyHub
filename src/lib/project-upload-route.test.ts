import { beforeEach, expect, it, vi } from "vitest";
const fake = vi.hoisted(() => ({
  session: vi.fn(),
  exam: vi.fn(),
  maintenance: vi.fn(),
  project: vi.fn(),
  prepare: vi.fn(),
}));
vi.mock("./authorization", () => ({ getCurrentSession: fake.session }));
vi.mock("./v2/exam-access", () => ({ examForLegacyUser: fake.exam }));
vi.mock("./v2/maintenance", () => ({
  backupMaintenanceActive: fake.maintenance,
}));
vi.mock("./projects", () => ({
  getUserProject: fake.project,
  prepareProjectUpload: fake.prepare,
  ProjectConflictError: class extends Error {},
}));
vi.mock("./request-security", () => ({
  isSameOriginRequest: (r: Request) =>
    r.headers.get("origin") === "http://localhost",
}));
import { POST } from "@/app/api/projects/[projectId]/upload-preview/route";
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("OPENSTUDYHUB_SURFACE", "app");
  fake.session.mockResolvedValue({ user: { id: 1 } });
  fake.exam.mockReturnValue(null);
  fake.maintenance.mockReturnValue(false);
  fake.project.mockReturnValue({ ownerUserId: 1 });
});
it("keeps surface, maintenance, origin, authentication, exam and ownership guards on the unbuffered upload route", async () => {
  const send = () =>
    POST(
      new Request("http://localhost/api/projects/1/upload-preview", {
        method: "POST",
        headers: {
          origin: "http://localhost",
          "content-type": "application/zip",
        },
        body: "invalid zip",
      }),
      { params: Promise.resolve({ projectId: "1" }) },
    );
  vi.stubEnv("OPENSTUDYHUB_SURFACE", "admin");
  expect((await send()).status).toBe(404);
  vi.stubEnv("OPENSTUDYHUB_SURFACE", "app");
  fake.maintenance.mockReturnValue(true);
  expect((await send()).status).toBe(503);
  fake.maintenance.mockReturnValue(false);
  fake.session.mockResolvedValue(null);
  expect((await send()).status).toBe(401);
  fake.session.mockResolvedValue({ user: { id: 1 } });
  fake.exam.mockReturnValue({ id: 1 });
  expect((await send()).status).toBe(403);
  fake.exam.mockReturnValue(null);
  fake.project.mockReturnValue({ ownerUserId: 2 });
  expect((await send()).status).toBe(403);
  expect(
    (
      await POST(
        new Request("http://localhost/api/projects/1/upload-preview", {
          method: "POST",
        }),
        { params: Promise.resolve({ projectId: "1" }) },
      )
    ).status,
  ).toBe(403);
  expect(fake.prepare).not.toHaveBeenCalled();
  vi.unstubAllEnvs();
});
