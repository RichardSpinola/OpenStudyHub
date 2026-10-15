export type FocusState = {
  phase: "focus" | "short" | "long";
  durations: { focus: number; short: number; long: number };
  remaining: number;
  deadline: number | null;
  cycles: number;
  active: boolean;
  elapsed: number;
  startedAt: number | null;
  laps: number[];
};
export function defaultFocus(): FocusState {
  return {
    phase: "focus",
    durations: { focus: 25, short: 5, long: 15 },
    remaining: 25 * 60000,
    deadline: null,
    cycles: 0,
    active: false,
    elapsed: 0,
    startedAt: null,
    laps: [],
  };
}
export function remainingFocus(state: FocusState, now: number) {
  return Math.max(
    0,
    state.deadline === null ? state.remaining : state.deadline - now,
  );
}
export function elapsedFocus(state: FocusState, now: number) {
  return Math.max(
    0,
    state.elapsed + (state.startedAt === null ? 0 : now - state.startedAt),
  );
}
export function nextFocusPhase(state: FocusState): FocusState {
  const cycles = state.cycles + (state.phase === "focus" ? 1 : 0),
    phase =
      state.phase === "focus" ? (cycles % 4 === 0 ? "long" : "short") : "focus";
  return {
    ...state,
    cycles,
    phase,
    remaining: state.durations[phase] * 60000,
    deadline: null,
    active: true,
  };
}
export function readFocus(value: string | null): FocusState {
  try {
    const s = JSON.parse(value ?? "null") as FocusState;
    if (
      !s ||
      !["focus", "short", "long"].includes(s.phase) ||
      !s.durations ||
      !Object.values(s.durations).every(
        (n) => Number.isFinite(n) && n >= 1 && n <= 180,
      ) ||
      Object.keys(s.durations).length !== 3 ||
      !["focus", "short", "long"].every((k) => k in s.durations) ||
      !Number.isFinite(s.remaining) ||
      s.remaining < 0 ||
      s.remaining > 180 * 60000 ||
      !Number.isInteger(s.cycles) ||
      s.cycles < 0 ||
      typeof s.active !== "boolean" ||
      ![s.deadline, s.startedAt].every(
        (n) => n === null || (Number.isFinite(n) && n >= 0),
      ) ||
      !Number.isFinite(s.elapsed) ||
      s.elapsed < 0 ||
      !Array.isArray(s.laps) ||
      s.laps.length > 100 ||
      !s.laps.every((n) => Number.isFinite(n) && n >= 0)
    )
      return defaultFocus();
    return s;
  } catch {
    return defaultFocus();
  }
}
export function clockText(ms: number) {
  const seconds = Math.floor(Math.max(0, ms) / 1000);
  const min = Math.floor(seconds / 60),
    sec = seconds % 60;
  return `${String(min).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}
