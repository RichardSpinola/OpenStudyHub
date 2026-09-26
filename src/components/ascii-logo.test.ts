import { describe, expect, it } from "vitest";

import { chooseAsciiLogoLayout } from "./ascii-logo";

describe("responsive ASCII logo", () => {
  it("uses a full, compact or framed variant according to available width", () => {
    expect(chooseAsciiLogoLayout(1200, 900, 400)).toEqual({
      variant: "full",
      fontSize: 14,
    });
    expect(chooseAsciiLogoLayout(520, 900, 400)).toEqual({
      variant: "compact",
      fontSize: 14,
    });
    expect(chooseAsciiLogoLayout(240, 900, 400)).toEqual({
      variant: "framed",
      fontSize: 12,
    });
  });
});
