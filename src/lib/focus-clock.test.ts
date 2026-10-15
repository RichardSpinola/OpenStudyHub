import { it, expect } from "vitest";
import {
  defaultFocus,
  remainingFocus,
  elapsedFocus,
  nextFocusPhase,
  readFocus,
  clockText,
} from "./focus-clock";
it("survives reload or a throttled background tab without losing elapsed wall time", () => {
  const s = {
    ...defaultFocus(),
    deadline: 10000,
    active: true,
    elapsed: 5000,
    startedAt: 2000,
  };
  const restored = readFocus(JSON.stringify(s));
  expect(remainingFocus(restored, 7000)).toBe(3000);
  expect(remainingFocus(restored, 12000)).toBe(0);
  expect(elapsedFocus(restored, 12000)).toBe(15000);
});
it("moves to long break after four focus cycles without starting automatically", () => {
  let s = defaultFocus();
  for (let i = 0; i < 4; i++) {
    s = nextFocusPhase(s);
    expect(s.phase).toBe(i === 3 ? "long" : "short");
    expect(s.deadline).toBeNull();
    expect(s.cycles).toBe(i + 1);
    s = nextFocusPhase(s);
    expect(s.phase).toBe("focus");
  }
  expect(s.cycles).toBe(4);
});
it("ignores corrupt browser data and formats long stopwatch sessions", () => {
  expect(readFocus("{bad")).toEqual(defaultFocus());
  expect(
    readFocus(
      JSON.stringify({
        ...defaultFocus(),
        durations: { focus: -1, short: 5, long: 15 },
      }),
    ),
  ).toEqual(defaultFocus());
  expect(clockText(3661000)).toBe("61:01");
});
