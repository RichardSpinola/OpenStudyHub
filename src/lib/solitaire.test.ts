import { describe, expect, it } from "vitest";
import {
  cardColor,
  cardRank,
  cardSuit,
  dealSolitaire,
  drawSolitaire,
  moveSolitaire,
  solitaireWon,
} from "./solitaire";

describe("Klondike", () => {
  it("distribui as 52 cartas uma vez e compra uma ou três", () => {
    const one = dealSolitaire(1, () => 0.5);
    expect(
      [...one.stock, ...one.tableau.flat().map((card) => card.id)].sort(
        (a, b) => a - b,
      ),
    ).toEqual(Array.from({ length: 52 }, (_, i) => i));
    expect(one.tableau.map((pile) => pile.length)).toEqual([
      1, 2, 3, 4, 5, 6, 7,
    ]);
    expect(drawSolitaire(one).waste.length).toBe(1);
    expect(drawSolitaire(dealSolitaire(3, () => 0.5)).waste.length).toBe(3);
  });
  it("exige ás na fundação, cores alternadas e rei em coluna vazia", () => {
    const game = dealSolitaire();
    const ace = 0,
      blackTwo = 1,
      redTwo = 14,
      king = 12;
    const state = {
      ...game,
      stock: [],
      waste: [redTwo, ace],
      foundations: [[], [], [], []],
      tableau: [[], [], [], [], [], [], []].map(() => []),
    };
    expect(
      moveSolitaire(state, { kind: "waste" }, { kind: "foundation", index: 0 })
        .foundations[0],
    ).toEqual([ace]);
    expect(
      moveSolitaire(state, { kind: "waste" }, { kind: "tableau", index: 0 }),
    ).toBe(state);
    const withKing = { ...state, waste: [king] };
    expect(
      moveSolitaire(withKing, { kind: "waste" }, { kind: "tableau", index: 0 })
        .tableau[0][0].id,
    ).toBe(king);
    expect(cardRank(blackTwo)).toBe(2);
    expect(cardColor(redTwo)).toBe("red");
    expect(cardSuit(ace)).toBe(0);
    expect(solitaireWon(game)).toBe(false);
  });
  it("move uma sequência válida e vira a carta exposta", () => {
    const game = dealSolitaire();
    const state = {
      ...game,
      stock: [],
      waste: [],
      foundations: [[], [], [], []],
      tableau: [
        [
          { id: 0, faceUp: false },
          { id: 12, faceUp: true },
          { id: 24, faceUp: true },
        ],
        [],
        [],
        [],
        [],
        [],
        [],
      ],
    };
    const moved = moveSolitaire(
      state,
      { kind: "tableau", index: 0, from: 1 },
      { kind: "tableau", index: 1 },
    );
    expect(moved.tableau[0]).toEqual([{ id: 0, faceUp: true }]);
    expect(moved.tableau[1].map(({ id }) => id)).toEqual([12, 24]);
    expect(
      solitaireWon({
        ...game,
        foundations: Array.from({ length: 4 }, (_, suit) =>
          Array.from({ length: 13 }, (_, rank) => suit * 13 + rank),
        ),
      }),
    ).toBe(true);
  });
});
