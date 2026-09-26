export type Seat = 0 | 1;
export type DominoTile = { id: number; a: number; b: number };
export type PlayedTile = DominoTile & { left: number; right: number };
export type DominoState = {
  hands: [number[], number[]];
  stock: number[];
  chain: PlayedTile[];
  turn: Seat;
  scores: [number, number];
  round: number;
  phase: "waiting" | "playing" | "finished";
  openingTile: number | null;
  consecutivePasses: number;
  lastRound: {
    winner: Seat | null;
    points: number;
    reason: "empty" | "blocked";
  } | null;
  winner: Seat | null;
};
export type DominoAction =
  | { type: "play"; tile: number; side: "left" | "right" }
  | { type: "draw" }
  | { type: "pass" }
  | { type: "resign" };
export const dominoTiles: DominoTile[] = (() => {
  const tiles: DominoTile[] = [];
  for (let a = 0; a <= 6; a++)
    for (let b = a; b <= 6; b++) tiles.push({ id: tiles.length, a, b });
  return tiles;
})();
export const tileById = (id: number) => dominoTiles[id];
const pips = (hand: number[]) =>
  hand.reduce((sum, id) => sum + tileById(id).a + tileById(id).b, 0);
function shuffled(random: () => number): number[] {
  const deck = dominoTiles.map(({ id }) => id);
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}
function opening(hands: [number[], number[]]): { seat: Seat; tile: number } {
  const owned = hands.flatMap((hand, seat) =>
    hand.map((id) => ({ id, seat: seat as Seat })),
  );
  owned.sort((x, y) => {
    const a = tileById(x.id),
      b = tileById(y.id);
    return (
      Number(b.a === b.b) - Number(a.a === a.b) ||
      b.a + b.b - a.a - a.b ||
      b.b - a.b
    );
  });
  return { seat: owned[0].seat, tile: owned[0].id };
}
export function newDominoRound(
  scores: [number, number] = [0, 0],
  round = 1,
  starter?: Seat,
  random = Math.random,
): DominoState {
  const deck = shuffled(random);
  const hands: [number[], number[]] = [deck.splice(0, 7), deck.splice(0, 7)];
  const first = opening(hands);
  return {
    hands,
    stock: deck,
    chain: [],
    turn: starter ?? first.seat,
    scores,
    round,
    phase: "playing",
    openingTile: starter === undefined ? first.tile : null,
    consecutivePasses: 0,
    lastRound: null,
    winner: null,
  };
}
export function waitingDomino(): DominoState {
  return {
    hands: [[], []],
    stock: [],
    chain: [],
    turn: 0,
    scores: [0, 0],
    round: 0,
    phase: "waiting",
    openingTile: null,
    consecutivePasses: 0,
    lastRound: null,
    winner: null,
  };
}
export function canPlayDomino(
  state: DominoState,
  seat: Seat,
  id: number,
  side: "left" | "right",
): boolean {
  if (
    state.phase !== "playing" ||
    seat !== state.turn ||
    !state.hands[seat].includes(id)
  )
    return false;
  if (!state.chain.length)
    return state.openingTile === null || state.openingTile === id;
  const tile = tileById(id);
  const endpoint =
    side === "left" ? state.chain[0].left : state.chain.at(-1)!.right;
  return tile.a === endpoint || tile.b === endpoint;
}
export function anyDominoPlay(state: DominoState, seat: Seat): boolean {
  return state.hands[seat].some(
    (id) =>
      canPlayDomino(state, seat, id, "left") ||
      canPlayDomino(state, seat, id, "right"),
  );
}
function finishRound(
  state: DominoState,
  winner: Seat | null,
  reason: "empty" | "blocked",
  random: () => number,
): DominoState {
  const score: [number, number] = [...state.scores];
  const points =
    winner === null
      ? 0
      : reason === "empty"
        ? pips(state.hands[(1 - winner) as Seat])
        : Math.max(
            0,
            pips(state.hands[(1 - winner) as Seat]) - pips(state.hands[winner]),
          );
  if (winner !== null) score[winner] += points;
  const lastRound = { winner, points, reason };
  if (score[0] >= 100 || score[1] >= 100)
    return {
      ...state,
      scores: score,
      phase: "finished",
      winner: score[0] > score[1] ? 0 : 1,
      lastRound,
    };
  return {
    ...newDominoRound(
      score,
      state.round + 1,
      winner ?? (state.turn === 0 ? 1 : 0),
      random,
    ),
    lastRound,
  };
}
export function applyDominoAction(
  state: DominoState,
  seat: Seat,
  action: DominoAction,
  random = Math.random,
): DominoState {
  if (state.phase !== "playing")
    throw new Error("Partida encerrada ou aguardando jogador.");
  if (action.type === "resign")
    return { ...state, phase: "finished", winner: seat === 0 ? 1 : 0 };
  if (state.turn !== seat) throw new Error("Não é sua vez.");
  if (action.type === "play") {
    if (!canPlayDomino(state, seat, action.tile, action.side))
      throw new Error("Peça ou lado inválido.");
    const tile = tileById(action.tile);
    const chain = [...state.chain];
    let placed: PlayedTile;
    if (!chain.length) placed = { ...tile, left: tile.a, right: tile.b };
    else if (action.side === "left") {
      const endpoint = chain[0].left;
      placed = {
        ...tile,
        left: tile.a === endpoint ? tile.b : tile.a,
        right: endpoint,
      };
    } else {
      const endpoint = chain.at(-1)!.right;
      placed = {
        ...tile,
        left: endpoint,
        right: tile.a === endpoint ? tile.b : tile.a,
      };
    }
    if (action.side === "left") chain.unshift(placed);
    else chain.push(placed);
    const hands: [number[], number[]] = [
      [...state.hands[0]],
      [...state.hands[1]],
    ];
    hands[seat] = hands[seat].filter((id) => id !== action.tile);
    const next: DominoState = {
      ...state,
      hands,
      chain,
      openingTile: null,
      consecutivePasses: 0,
      turn: seat === 0 ? 1 : 0,
    };
    return hands[seat].length ? next : finishRound(next, seat, "empty", random);
  }
  if (anyDominoPlay(state, seat)) throw new Error("Jogue uma peça disponível.");
  if (action.type === "draw") {
    if (!state.stock.length) throw new Error("O monte está vazio.");
    const stock = [...state.stock];
    const hands: [number[], number[]] = [
      [...state.hands[0]],
      [...state.hands[1]],
    ];
    hands[seat].push(stock.pop()!);
    return { ...state, stock, hands };
  }
  if (state.stock.length) throw new Error("Compre do monte antes de passar.");
  const next: DominoState = {
    ...state,
    turn: seat === 0 ? 1 : 0,
    consecutivePasses: state.consecutivePasses + 1,
  };
  if (next.consecutivePasses < 2) return next;
  const sums = [pips(state.hands[0]), pips(state.hands[1])];
  const winner =
    sums[0] === sums[1] ? null : ((sums[0] < sums[1] ? 0 : 1) as Seat);
  return finishRound(next, winner, "blocked", random);
}
export function dominoView(state: DominoState, seat: Seat) {
  return {
    hand: state.hands[seat],
    opponentCount: state.hands[seat === 0 ? 1 : 0].length,
    stockCount: state.stock.length,
    chain: state.chain,
    turn: state.turn,
    scores: state.scores,
    round: state.round,
    phase: state.phase,
    openingTile:
      state.openingTile === null || state.turn !== seat
        ? null
        : state.openingTile,
    consecutivePasses: state.consecutivePasses,
    lastRound: state.lastRound,
    winner: state.winner,
    canPlay: state.hands[seat].filter(
      (id) =>
        canPlayDomino(state, seat, id, "left") ||
        canPlayDomino(state, seat, id, "right"),
    ),
  };
}
