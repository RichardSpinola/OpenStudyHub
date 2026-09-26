export type Grid2048 = number[];

export function slide2048(
  grid: Grid2048,
  direction: "left" | "right" | "up" | "down",
) {
  const next = [...grid];
  let gained = 0;
  for (let line = 0; line < 4; line++) {
    const indices = Array.from({ length: 4 }, (_, index) =>
      direction === "left"
        ? line * 4 + index
        : direction === "right"
          ? line * 4 + 3 - index
          : direction === "up"
            ? index * 4 + line
            : (3 - index) * 4 + line,
    );
    const values = indices
      .map((index) => grid[index])
      .filter((value) => value !== 0);
    const merged: number[] = [];
    for (let i = 0; i < values.length; i++) {
      if (values[i] === values[i + 1]) {
        const value = values[i] * 2;
        gained += value;
        merged.push(value);
        i++;
      } else merged.push(values[i]);
    }
    indices.forEach((index, offset) => {
      next[index] = merged[offset] ?? 0;
    });
  }
  return {
    grid: next,
    gained,
    moved: next.some((value, index) => value !== grid[index]),
  };
}

export function spawn2048(grid: Grid2048, random = Math.random): Grid2048 {
  const empty = grid
    .map((value, index) => (value === 0 ? index : -1))
    .filter((index) => index >= 0);
  if (!empty.length) return grid;
  const next = [...grid];
  next[empty[Math.floor(random() * empty.length)]] = random() < 0.9 ? 2 : 4;
  return next;
}

export function mineNeighbors(index: number, width = 8): number[] {
  const x = index % width;
  const y = Math.floor(index / width);
  const result: number[] = [];
  for (let dy = -1; dy <= 1; dy++)
    for (let dx = -1; dx <= 1; dx++) {
      const nx = x + dx;
      const ny = y + dy;
      if ((dx || dy) && nx >= 0 && nx < width && ny >= 0 && ny < width)
        result.push(ny * width + nx);
    }
  return result;
}

export function mineChordTargets(
  index: number,
  width: number,
  mines: readonly number[],
  opened: ReadonlySet<number>,
  flags: ReadonlySet<number>,
): number[] {
  if (!opened.has(index)) return [];
  const neighbors = mineNeighbors(index, width);
  const number = neighbors.filter((cell) => mines.includes(cell)).length;
  if (!number || neighbors.filter((cell) => flags.has(cell)).length !== number)
    return [];
  return neighbors.filter((cell) => !opened.has(cell) && !flags.has(cell));
}

export function placeMines(firstClick: number, random = Math.random): number[] {
  return placeMinesForBoard(firstClick, 8, 10, random);
}

export function placeMinesForBoard(
  firstClick: number,
  width: number,
  count: number,
  random = Math.random,
): number[] {
  if (width < 4 || count < 1 || count > width * width - 9)
    throw new Error("Configuração inválida.");
  const candidates = Array.from(
    { length: width * width },
    (_, index) => index,
  ).filter(
    (index) =>
      index !== firstClick && !mineNeighbors(firstClick, width).includes(index),
  );
  const mines: number[] = [];
  while (mines.length < count) {
    const chosen = Math.floor(random() * candidates.length);
    mines.push(candidates.splice(chosen, 1)[0]);
  }
  return mines;
}
