import { it, expect } from "vitest";
import { realtimeBudget } from "./realtime-budget";
it("bounds repeated realtime events per socket and permits normal use again after the window", () => {
  const allow = realtimeBudget(3, 1000),
    other = realtimeBudget(3, 1000);
  expect(allow(1000)).toBe(true);
  expect(allow(1001)).toBe(true);
  expect(allow(1002)).toBe(true);
  expect(allow(1003)).toBe(false);
  expect(other(1003)).toBe(true);
  expect(allow(2000)).toBe(true);
});
