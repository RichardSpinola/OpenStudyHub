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

  it("usa somente os provedores aprovados", () => {
    expect(buildWebSearchUrl("álgebra", "scholar")?.hostname).toBe(
      "scholar.google.com",
    );
    expect(buildWebSearchUrl("álgebra", "duckduckgo")?.hostname).toBe(
      "duckduckgo.com",
    );
    expect(
      buildWebSearchUrl("álgebra", "startpage")?.searchParams.get("query"),
    ).toBe("álgebra");
    expect(buildWebSearchUrl("álgebra", "ecosia")?.hostname).toBe(
      "www.ecosia.org",
    );
  });
});
