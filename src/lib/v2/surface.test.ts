import { describe, expect, it } from "vitest";
import { configuredSurface, surfaceRoute } from "./surface";

describe("separação das superfícies", () => {
  it("não expõe Control Plane na origem pública por padrão de produção", () => {
    const surface = configuredSurface(undefined, true);
    expect(surfaceRoute(surface, "/control/login")).toBe("blocked");
    expect(surfaceRoute(surface, "/login")).toBe("app");
  });
  it("isola app e APIs normais na origem administrativa", () => {
    expect(surfaceRoute("admin", "/control/users")).toBe("admin");
    expect(surfaceRoute("admin", "/api/v2/classroom/sync")).toBe("blocked");
    expect(surfaceRoute("admin", "/")).toBe("admin-home");
  });
  it("permite as duas superfícies apenas no modo combinado de QA", () => {
    expect(surfaceRoute("combined", "/control/login")).toBe("admin");
    expect(surfaceRoute("combined", "/login")).toBe("app");
  });
});
