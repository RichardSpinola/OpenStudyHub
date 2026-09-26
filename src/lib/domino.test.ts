import { describe, expect, it } from "vitest";
import {
  applyDominoAction,
  canPlayDomino,
  dominoTiles,
  dominoView,
  newDominoRound,
} from "./domino";

describe("Dominó duplo-seis", () => {
  it("distribui 28 peças sem repetição e oculta a mão adversária", () => {
    const state = newDominoRound([0, 0], 1, undefined, () => 0.4);
    expect(
      [...state.hands[0], ...state.hands[1], ...state.stock].sort(
        (a, b) => a - b,
      ),
    ).toEqual(dominoTiles.map((tile) => tile.id));
    const view = dominoView(state, 0);
    expect(view.hand).toEqual(state.hands[0]);
    expect(JSON.stringify(view)).not.toContain(JSON.stringify(state.hands[1]));
  });
  it("só permite jogar a abertura correta e impede ação fora da vez", () => {
    const state = newDominoRound([0, 0], 1, undefined, () => 0.4);
    const opener = state.openingTile!;
    expect(canPlayDomino(state, state.turn, opener, "left")).toBe(true);
    expect(() =>
      applyDominoAction(state, state.turn === 0 ? 1 : 0, {
        type: "play",
        tile: opener,
        side: "left",
      }),
    ).toThrow();
    const played = applyDominoAction(state, state.turn, {
      type: "play",
      tile: opener,
      side: "left",
    });
    expect(played.chain).toHaveLength(1);
    expect(played.turn).not.toBe(state.turn);
  });
  it("permite abandonar e mantém estado para retomada", () => {
    const state = newDominoRound();
    const finished = applyDominoAction(state, state.turn, { type: "resign" });
    expect(finished.phase).toBe("finished");
    expect(finished.winner).not.toBe(state.turn);
    expect(JSON.parse(JSON.stringify(finished))).toEqual(finished);
  });
  it("obriga compra antes de passar e encerra mesa bloqueada", () => {
    const base = newDominoRound();
    const blocked = {
      ...base,
      hands: [[0], [1]] as [number[], number[]],
      stock: [26],
      chain: [{ ...dominoTiles[27], left: 6, right: 6 }],
      turn: 0 as const,
      openingTile: null,
    };
    expect(() => applyDominoAction(blocked, 0, { type: "pass" })).toThrow(
      "Compre",
    );
    const bought = applyDominoAction(blocked, 0, { type: "draw" });
    expect(bought.hands[0]).toHaveLength(2);
    expect(bought.turn).toBe(0);
    const firstPass = applyDominoAction({ ...blocked, stock: [] }, 0, {
      type: "pass",
    });
    const resolved = applyDominoAction(firstPass, 1, { type: "pass" });
    expect(resolved.lastRound?.reason).toBe("blocked");
    expect(resolved.lastRound?.winner).toBe(0);
  });
});
