import { describe, expect, it } from "vitest";
import { migrateV2, openV2Database } from "./database";
import { extraAccessible, getExtrasFlags, updateExtrasFlags } from "./extras";
import {
  changedBoardElements,
  readGlobalWhiteboard,
  updateGlobalWhiteboard,
} from "./whiteboard";

describe("Extras da instância", () => {
  it("bloqueia cada rota desativada, inclusive quando a URL é conhecida", () => {
    const db = openV2Database(":memory:");
    try {
      migrateV2(db);
      const flags = getExtrasFlags(db);
      expect(extraAccessible(flags, "whiteboard")).toBe(true);
      updateExtrasFlags(db, { ...flags, extras: false });
      expect(extraAccessible(getExtrasFlags(db), "whiteboard")).toBe(false);
      updateExtrasFlags(db, { ...flags, snake: false });
      expect(extraAccessible(getExtrasFlags(db), "snake")).toBe(false);
      expect(extraAccessible(getExtrasFlags(db), "2048")).toBe(true);
      updateExtrasFlags(db, { ...flags, domino: false, solitaire: true });
      expect(extraAccessible(getExtrasFlags(db), "domino")).toBe(false);
      expect(extraAccessible(getExtrasFlags(db), "solitaire")).toBe(true);
    } finally {
      db.close();
    }
  });

  it("persiste e combina mudanças por versão de elemento sem apagar o desenho de outro usuário", () => {
    const db = openV2Database(":memory:");
    try {
      migrateV2(db);
      const one = { id: "a", version: 1, isDeleted: false, type: "rectangle" };
      const two = { id: "b", version: 1, isDeleted: false, type: "text" };
      updateGlobalWhiteboard(db, [one]);
      updateGlobalWhiteboard(db, [two]);
      expect(readGlobalWhiteboard(db).map((element) => element.id)).toEqual([
        "a",
        "b",
      ]);
      updateGlobalWhiteboard(db, [{ ...one, version: 2, isDeleted: true }]);
      expect(
        readGlobalWhiteboard(db).find((element) => element.id === "a")
          ?.isDeleted,
      ).toBe(true);
      expect(() =>
        updateGlobalWhiteboard(db, [
          { id: "photo", version: 1, isDeleted: false, type: "image" },
        ]),
      ).toThrow("Imagens ainda não são suportadas");
    } finally {
      db.close();
    }
  });

  it("envia só elementos alterados, inclusive desempate da mesma versão", () => {
    const elements = [
      { id: "a", version: 1, versionNonce: 3, isDeleted: false },
      { id: "b", version: 2, versionNonce: 7, isDeleted: false },
    ];
    const known = new Map([["a", "1:3"]]);
    expect(changedBoardElements(elements, known).map(({ id }) => id)).toEqual([
      "b",
    ]);
    expect(
      changedBoardElements([{ ...elements[0], versionNonce: 4 }], known),
    ).toHaveLength(1);
  });
});
