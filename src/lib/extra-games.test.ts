import { describe, it, expect } from "vitest";
import {
  shuffledPairs,
  lineWinner,
  dropPiece,
  lineBot,
  sudokuCatalog,
  sudokuSolutions,
} from "./extra-games";
describe("new games", () => {
  it("deals exactly two of each symbol at every size", () => {
    for (const pairs of [8, 12, 18]) {
      const cards = shuffledPairs(pairs, () => 0.3);
      expect(cards).toHaveLength(pairs * 2);
      for (let i = 0; i < pairs; i++)
        expect(cards.filter((v) => v === i)).toHaveLength(2);
    }
  });
  it("does not wrap winning lines across edges", () => {
    expect(lineWinner([1, 1, 1, 0, 0, 0, 0, 0, 0], 3, 3, 3)).toBe(1);
    expect(lineWinner([0, 0, 1, 1, 1, 0, 0, 0, 0], 3, 3, 3)).toBe(0);
    expect(lineWinner([2, 0, 0, 0, 2, 0, 0, 0, 2], 3, 3, 3)).toBe(2);
  });
  it("drops pieces to the lowest free row and rejects full columns", () => {
    let board = Array(42).fill(0);
    for (let i = 0; i < 6; i++) {
      board = dropPiece(board, 2, (i % 2) + 1)!;
      expect(board[(5 - i) * 7 + 2]).toBe((i % 2) + 1);
    }
    expect(dropPiece(board, 2, 1)).toBeNull();
    expect(dropPiece(board, 7, 1)).toBeNull();
  });
  it("bots take a win and block an immediate loss", () => {
    expect(lineBot([2, 2, 0, 1, 1, 0, 0, 0, 0], false)).toBe(2);
    expect(lineBot([1, 1, 0, 0, 2, 0, 0, 0, 0], false)).toBe(2);
    let board = Array(42).fill(0);
    for (const c of [0, 1, 2]) board = dropPiece(board, c, 1)!;
    expect(lineBot(board, true)).toBe(3);
  });
  it.each(Object.entries(sudokuCatalog))(
    "catalog %s has one valid solution",
    (_, source) => {
      const puzzle = source.split("").map(Number),
        solutions = sudokuSolutions(puzzle);
      expect(solutions).toHaveLength(1);
      expect(solutions[0].every((v, i) => !puzzle[i] || v === puzzle[i])).toBe(
        true,
      );
      for (let row = 0; row < 9; row++)
        expect(new Set(solutions[0].slice(row * 9, row * 9 + 9)).size).toBe(9);
    },
  );
  it("rejects conflicting Sudoku clues", () => {
    const b = Array(81).fill(0);
    b[0] = 1;
    b[1] = 1;
    expect(sudokuSolutions(b)).toEqual([]);
  });
});
