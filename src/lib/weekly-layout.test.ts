import { describe, it, expect } from "vitest";
import type { AgendaSlot } from "./academic";
import { weeklyLayout } from "./weekly-layout";
const slot = (id: number, start: number, end: number, weekday = 1) =>
  ({
    slotId: id,
    weekday,
    startsAtMinutes: start,
    endsAtMinutes: end,
  }) as AgendaSlot;
describe("weekly schedule placement", () => {
  it("keeps exact five-minute starts and durations on one time scale", () => {
    const value = weeklyLayout([
      slot(1, 420, 495),
      slot(2, 505, 580),
      slot(3, 590, 665),
      slot(4, 675, 750),
    ]);
    expect([value.start, value.end]).toEqual([420, 750]);
    expect(
      value.events.map((e) => [(e.row - 2) * 5 + value.start, e.span * 5]),
    ).toEqual([
      [420, 75],
      [505, 75],
      [590, 75],
      [675, 75],
    ]);
  });
  it("places overlapping lessons side by side but not consecutive lessons", () => {
    const value = weeklyLayout([
      slot(1, 480, 570),
      slot(2, 510, 600),
      slot(3, 600, 660),
    ]);
    expect(value.events.map((e) => [e.lane, e.lanes])).toEqual([
      [0, 2],
      [1, 2],
      [0, 1],
    ]);
  });
  it("includes evening/Sunday classes and rejects invalid intervals", () => {
    const value = weeklyLayout([
      slot(1, 1380, 1440, 7),
      slot(2, 480, 420),
      slot(3, 480, 540, 8),
    ]);
    expect([value.start, value.end, value.events.length]).toEqual([
      1380, 1440, 1,
    ]);
    expect(weeklyLayout([]).events).toEqual([]);
  });
});
