import { describe, expect, it } from "vitest";
import { filterLibraryItems } from "./filters";
const items = [
  {
    name: "Relatório de aula",
    offeringId: 1,
    subjectName: "A",
    shared: false,
    updatedAt: 20,
  },
  {
    name: "Projeto de grupo",
    offeringId: 2,
    subjectName: "B",
    shared: true,
    updatedAt: 30,
  },
  {
    name: "Arquivo pessoal",
    offeringId: null,
    subjectName: null,
    shared: false,
    updatedAt: 10,
  },
];
describe("library selection", () => {
  it("combines accent-insensitive name, offering and access filters", () => {
    expect(
      filterLibraryItems(items, {
        scope: "mine",
        query: "relatorio",
        offeringId: 1,
      }),
    ).toEqual([items[0]]);
    expect(
      filterLibraryItems(items, {
        scope: "shared",
        query: "",
        offeringId: null,
      }),
    ).toEqual([items[1]]);
    expect(
      filterLibraryItems(items, { scope: "shared", query: "", offeringId: 1 }),
    ).toEqual([]);
  });
  it("orders only supplied accessible items without mutating them", () => {
    expect(
      filterLibraryItems(items, { scope: "all", query: "", offeringId: null }),
    ).toEqual([items[1], items[0], items[2]]);
    expect(items[0].name).toBe("Relatório de aula");
  });
});
