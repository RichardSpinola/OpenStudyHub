import { describe, expect, it } from "vitest";
import {
  mineChordTargets,
  mineNeighbors,
  placeMines,
  slide2048,
} from "./minigames";

describe("minigames locais", () => {
  it("funde números uma vez por movimento", () => {
    expect(slide2048([2, 2, 2, 2, ...Array(12).fill(0)], "left")).toMatchObject(
      { grid: [4, 4, 0, 0, ...Array(12).fill(0)], gained: 8, moved: true },
    );
  });

  it("garante que a primeira casa do Campo Minado e seus vizinhos sejam seguros", () => {
    const mines = placeMines(0, () => 0);
    expect(mines).toHaveLength(10);
    expect(mines).not.toContain(0);
    for (const neighbor of mineNeighbors(0))
      expect(mines).not.toContain(neighbor);
  });

  it("abre vizinhos por acorde apenas com o número correto de bandeiras", () => {
    const opened = new Set([9]);
    expect(mineChordTargets(9, 4, [5], opened, new Set())).toEqual([]);
    expect(mineChordTargets(9, 4, [5], opened, new Set([6]))).toContain(5);
    expect(mineChordTargets(9, 4, [5], opened, new Set([5]))).toEqual(
      mineNeighbors(9, 4).filter((cell) => cell !== 5),
    );
    expect(mineChordTargets(10, 4, [5], opened, new Set([5]))).toEqual([]);
  });
});
