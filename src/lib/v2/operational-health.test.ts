import { it, expect, vi } from "vitest";
const probe = vi.hoisted(() => vi.fn());
vi.mock("./operational-health", () => ({ operationalHealth: probe }));
import { GET } from "@/app/api/health/route";
it("reports canonical database failure and returns sanitized public health without paths or credentials", async () => {
  probe.mockResolvedValue({
    database: "operational",
    canonical: "unavailable",
    storage: "operational",
    realtime: "unavailable",
    maintenance: false,
    freeBytes: 12345,
    checkedAt: 1,
    privatePath: "/sensitive/location",
    secret: "must not appear",
  });
  const response = await GET();
  expect(response.status).toBe(503);
  const body = await response.text();
  expect(body).toContain('"canonical":"unavailable"');
  expect(body).not.toContain("sensitive");
  expect(body).not.toContain("must not appear");
  expect(body).not.toContain("freeBytes");
  probe.mockResolvedValue({
    database: "operational",
    canonical: "operational",
    storage: "operational",
    realtime: "unavailable",
    maintenance: false,
  });
  const degraded = await GET();
  expect(degraded.status).toBe(200);
  expect(await degraded.json()).toMatchObject({ status: "degraded" });
});
