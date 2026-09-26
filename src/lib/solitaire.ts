export type Suit = 0 | 1 | 2 | 3;
export type DrawCount = 1 | 3;
export type Pile =
  | { kind: "waste" }
  | { kind: "foundation"; index: number }
  | { kind: "tableau"; index: number; from: number };
export type Target = { kind: "foundation" | "tableau"; index: number };
export type TableauCard = { id: number; faceUp: boolean };
export type SolitaireState = {
  stock: number[];
  waste: number[];
  foundations: number[][];
  tableau: TableauCard[][];
  drawCount: DrawCount;
  moves: number;
};
export const suitSymbols = ["♣", "♥", "♦", "♠"] as const;
export const cardRank = (id: number) => (id % 13) + 1;
export const cardSuit = (id: number): Suit => Math.floor(id / 13) as Suit;
export const cardColor = (id: number) =>
  cardSuit(id) === 1 || cardSuit(id) === 2 ? "red" : "black";
export const cardLabel = (id: number) =>
  `${["", "A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"][cardRank(id)]}${suitSymbols[cardSuit(id)]}`;

export function dealSolitaire(
  drawCount: DrawCount = 1,
  random = Math.random,
): SolitaireState {
  const deck = Array.from({ length: 52 }, (_, id) => id);
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  const tableau: TableauCard[][] = [];
  for (let column = 0; column < 7; column++) {
    tableau.push(
      deck
        .splice(0, column + 1)
        .map((id, index) => ({ id, faceUp: index === column })),
    );
  }
  return {
    stock: deck,
    waste: [],
    foundations: [[], [], [], []],
    tableau,
    drawCount,
    moves: 0,
  };
}

export function drawSolitaire(state: SolitaireState): SolitaireState {
  if (!state.stock.length && !state.waste.length) return state;
  if (!state.stock.length)
    return {
      ...state,
      stock: [...state.waste].reverse(),
      waste: [],
      moves: state.moves + 1,
    };
  const stock = [...state.stock];
  const waste = [...state.waste];
  for (let i = 0; i < state.drawCount && stock.length; i++)
    waste.push(stock.pop()!);
  return { ...state, stock, waste, moves: state.moves + 1 };
}

function selectedCards(state: SolitaireState, source: Pile): number[] | null {
  if (source.kind === "waste")
    return state.waste.length ? [state.waste.at(-1)!] : null;
  if (source.kind === "foundation")
    return state.foundations[source.index]?.length
      ? [state.foundations[source.index].at(-1)!]
      : null;
  const pile = state.tableau[source.index];
  if (!pile || !pile[source.from]?.faceUp) return null;
  const cards = pile.slice(source.from);
  for (let i = 1; i < cards.length; i++)
    if (
      !cards[i].faceUp ||
      cardColor(cards[i - 1].id) === cardColor(cards[i].id) ||
      cardRank(cards[i - 1].id) !== cardRank(cards[i].id) + 1
    )
      return null;
  return cards.map(({ id }) => id);
}

export function moveSolitaire(
  state: SolitaireState,
  source: Pile,
  target: Target,
): SolitaireState {
  const cards = selectedCards(state, source);
  if (!cards?.length) return state;
  if (source.kind === target.kind && source.index === target.index)
    return state;
  const first = cards[0];
  if (target.kind === "foundation") {
    if (cards.length !== 1 || target.index !== cardSuit(first)) return state;
    const top = state.foundations[target.index].at(-1);
    if (
      top === undefined
        ? cardRank(first) !== 1
        : cardRank(first) !== cardRank(top) + 1
    )
      return state;
  } else {
    const pile = state.tableau[target.index];
    if (!pile) return state;
    const top = pile.at(-1)?.id;
    if (
      top === undefined
        ? cardRank(first) !== 13
        : cardRank(first) !== cardRank(top) - 1 ||
          cardColor(first) === cardColor(top)
    )
      return state;
  }
  const next: SolitaireState = {
    ...state,
    stock: [...state.stock],
    waste: [...state.waste],
    foundations: state.foundations.map((pile) => [...pile]),
    tableau: state.tableau.map((pile) => pile.map((card) => ({ ...card }))),
    moves: state.moves + 1,
  };
  if (source.kind === "waste") next.waste.pop();
  else if (source.kind === "foundation") next.foundations[source.index].pop();
  else {
    next.tableau[source.index].splice(source.from);
    const exposed = next.tableau[source.index].at(-1);
    if (exposed) exposed.faceUp = true;
  }
  if (target.kind === "foundation") next.foundations[target.index].push(first);
  else
    next.tableau[target.index].push(
      ...cards.map((id) => ({ id, faceUp: true })),
    );
  return next;
}
export const solitaireWon = (state: SolitaireState) =>
  state.foundations.every((pile) => pile.length === 13);
