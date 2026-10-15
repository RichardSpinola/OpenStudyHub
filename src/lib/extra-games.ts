export const newGameIds = [
  "memory",
  "sudoku",
  "connect4",
  "tictactoe",
] as const;
export type NewGame = (typeof newGameIds)[number];
export function shuffledPairs(pairs: number, random = Math.random) {
  const cards = Array.from({ length: pairs * 2 }, (_, i) => i % pairs);
  for (let i = cards.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [cards[i], cards[j]] = [cards[j], cards[i]];
  }
  return cards;
}
export function lineWinner(
  board: number[],
  width: number,
  height: number,
  length: number,
) {
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const player = board[y * width + x];
      if (!player) continue;
      for (const [dx, dy] of [
        [1, 0],
        [0, 1],
        [1, 1],
        [1, -1],
      ]) {
        const endX = x + dx * (length - 1),
          endY = y + dy * (length - 1);
        if (endX < 0 || endX >= width || endY < 0 || endY >= height) continue;
        if (
          Array.from(
            { length },
            (_, i) => board[(y + dy * i) * width + x + dx * i],
          ).every((v) => v === player)
        )
          return player;
      }
    }
  return 0;
}
export function dropPiece(board: number[], column: number, player: number) {
  if (column < 0 || column > 6 || !Number.isInteger(column)) return null;
  for (let row = 5; row >= 0; row--)
    if (!board[row * 7 + column]) {
      const next = [...board];
      next[row * 7 + column] = player;
      return next;
    }
  return null;
}
export function lineBot(board: number[], connect: boolean): number {
  const width = connect ? 7 : 3,
    height = connect ? 6 : 3,
    length = connect ? 4 : 3;
  const moves = (b: number[]) =>
    connect
      ? [3, 2, 4, 1, 5, 0, 6].filter((c) => !b[c])
      : b.flatMap((p, i) => (p ? [] : [i]));
  const play = (b: number[], m: number, p: number) =>
    connect ? dropPiece(b, m, p)! : b.map((v, i) => (i === m ? p : v));
  function score(b: number[], depth: number, player: number): number {
    const winner = lineWinner(b, width, height, length);
    if (winner) return winner === 2 ? 100 + depth : -100 - depth;
    const choices = moves(b);
    if (!depth || !choices.length)
      return connect
        ? b.reduce(
            (s, v, i) =>
              s + (i % 7 === 3 ? (v === 2 ? 2 : v === 1 ? -2 : 0) : 0),
            0,
          )
        : 0;
    const scores = choices.map((m) =>
      score(play(b, m, player), depth - 1, 3 - player),
    );
    return player === 2 ? Math.max(...scores) : Math.min(...scores);
  }
  const choices = moves(board);
  let best = -Infinity,
    result = -1;
  for (const m of choices) {
    const value = score(play(board, m, 2), connect ? 3 : 8, 1);
    if (value > best) {
      best = value;
      result = m;
    }
  }
  return result;
}
export const sudokuCatalog = {
  easy: "000260701680070090190004500820100040004602900050003028009300074040050036703018000",
  medium:
    "530070000600195000098000060800060003400803001700020006060000280000419005000080079",
  hard: "000000010400000000020000000000050407008000300001090000300400200050100000000806000",
};
export function sudokuSolutions(input: number[], limit = 2): number[][] {
  const b = [...input],
    found: number[][] = [];
  let visits = 0;
  function available(index: number) {
    const row = Math.floor(index / 9),
      col = index % 9;
    return [1, 2, 3, 4, 5, 6, 7, 8, 9].filter(
      (n) =>
        !b.some(
          (v, i) =>
            v === n &&
            (Math.floor(i / 9) === row ||
              i % 9 === col ||
              (Math.floor(i / 27) === Math.floor(row / 3) &&
                Math.floor((i % 9) / 3) === Math.floor(col / 3))),
        ),
    );
  }
  function solve() {
    if (++visits > 300000 || found.length >= limit) return;
    let cell = -1,
      options: number[] = [];
    for (let i = 0; i < 81; i++)
      if (!b[i]) {
        const values = available(i);
        if (!values.length) return;
        if (cell < 0 || values.length < options.length) {
          cell = i;
          options = values;
        }
        if (values.length === 1) break;
      }
    if (cell < 0) {
      found.push([...b]);
      return;
    }
    for (const n of options) {
      b[cell] = n;
      solve();
      if (found.length >= limit) break;
    }
    b[cell] = 0;
  }
  if (b.length !== 81 || b.some((v) => !Number.isInteger(v) || v < 0 || v > 9))
    return [];
  for (let i = 0; i < 81; i++)
    if (b[i]) {
      const v = b[i];
      b[i] = 0;
      if (!available(i).includes(v)) return [];
      b[i] = v;
    }
  solve();
  return found;
}
