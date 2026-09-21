import { describe, expect, it } from "vitest";

import { buildWebSearchUrl } from "./search";

describe("buildWebSearchUrl", () => {
  it("cria uma busca Google com a consulta codificada", () => {
    const destination = buildWebSearchUrl("  cálculo & lógica  ");

    expect(destination?.origin).toBe("https://www.google.com");
    expect(destination?.pathname).toBe("/search");
    expect(destination?.searchParams.get("q")).toBe("cálculo & lógica");
  });

  it("recusa consultas vazias", () => {
    expect(buildWebSearchUrl("   ")).toBeNull();
  });
});
