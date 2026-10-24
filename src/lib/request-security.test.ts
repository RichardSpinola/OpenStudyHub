import { describe, expect, it } from "vitest";
import { isSameOriginRequest } from "./request-security";

const request = (origin: string | null, host: string | null) =>
  new Request("http://localhost:3000/control/ai/manage", {
    method: "POST",
    headers: {
      ...(origin ? { origin } : {}),
      ...(host ? { host } : {}),
    },
  });

describe("isSameOriginRequest", () => {
  it("accepts the LAN Admin address published through a port mapping", () => {
    expect(
      isSameOriginRequest(
        request("http://192.168.1.70:3001", "192.168.1.70:3001"),
      ),
    ).toBe(true);
  });
  it("rejects cross-site and missing origins", () => {
    expect(
      isSameOriginRequest(request("https://evil.example", "192.168.1.70:3001")),
    ).toBe(false);
    expect(isSameOriginRequest(request(null, "192.168.1.70:3001"))).toBe(false);
    expect(
      isSameOriginRequest(
        request("http://192.168.1.70:3002", "192.168.1.70:3001"),
      ),
    ).toBe(false);
  });
});
