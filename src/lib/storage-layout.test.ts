import { describe, expect, it } from "vitest";

import {
  buildOfferingStoragePath,
  buildStoragePath,
  defaultStorageLayout,
  storageLayoutSchema,
} from "@/lib/storage-layout";

const context = {
  program: { name: "Ciência da Computação", shortName: "CC" },
  cohort: { name: "Turma 2026" },
  period: { label: "2026.2" },
  subject: { name: "Sistemas Distribuídos", shortName: "SD" },
};

describe("storage layout", () => {
  it("monta o caminho com cohort quando disponível", () => {
    expect(buildStoragePath(defaultStorageLayout, context, "projects")).toEqual(
      ["CC", "Turma 2026", "2026.2", "Sistemas Distribuídos", "Projetos"],
    );
  });

  it("monta a hierarquia base da oferta sem categoria", () => {
    expect(buildOfferingStoragePath(defaultStorageLayout, context)).toEqual([
      "CC",
      "Turma 2026",
      "2026.2",
      "Sistemas Distribuídos",
    ]);
  });

  it("oferece uma categoria própria para documentos", () => {
    expect(
      buildStoragePath(defaultStorageLayout, context, "documents"),
    ).toEqual([
      "CC",
      "Turma 2026",
      "2026.2",
      "Sistemas Distribuídos",
      "Documentos",
    ]);
  });

  it("omite cohort quando a configuração desabilita", () => {
    expect(
      buildStoragePath(
        { ...defaultStorageLayout, includeCohort: false },
        context,
        "projects",
      ),
    ).toEqual(["CC", "2026.2", "Sistemas Distribuídos", "Projetos"]);
  });

  it("rejeita traversal em patterns e labels", () => {
    expect(() =>
      storageLayoutSchema.parse({
        ...defaultStorageLayout,
        patterns: { ...defaultStorageLayout.patterns, subject: "../escape" },
      }),
    ).toThrow();
    expect(() =>
      storageLayoutSchema.parse({
        ...defaultStorageLayout,
        categories: [
          {
            key: "projects",
            label: "../Projetos",
            kind: "projects",
            enabled: true,
          },
        ],
      }),
    ).toThrow();
  });
});
