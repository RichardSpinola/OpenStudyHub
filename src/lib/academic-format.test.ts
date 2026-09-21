import { describe, expect, it } from "vitest";

import { formatMinutes, joinLocation } from "./academic-format";

describe("academic formatting", () => {
  it("formata minutos como horário de 24 horas", () => {
    expect(formatMinutes(420)).toBe("07:00");
    expect(formatMinutes(505)).toBe("08:25");
    expect(formatMinutes(1440)).toBe("24:00");
  });

  it("combina somente partes conhecidas da localização", () => {
    expect(joinLocation(["Campus", null, "Sala 1"])).toBe("Campus / Sala 1");
    expect(joinLocation([null, null])).toBeNull();
  });
});
