import { describe, expect, it } from "vitest";
import { accessibleAccent, contrastRatio } from "./appearance-color";

describe("safe accent", () => {
  it("keeps custom colors legible on both neutral modes", () => {
    for (const hex of ["#ffffff", "#000000", "#ff0000", "#ffff00", "#7b49a5"]) {
      expect(
        contrastRatio(accessibleAccent(hex, "dark"), "#1c1c1c"),
      ).toBeGreaterThanOrEqual(4.5);
      expect(
        contrastRatio(accessibleAccent(hex, "light"), "#ffffff"),
      ).toBeGreaterThanOrEqual(4.5);
    }
  });
  it("rejects CSS or incomplete colors", () => {
    expect(() => accessibleAccent("#fff;url(x)", "dark")).toThrow();
  });
});
