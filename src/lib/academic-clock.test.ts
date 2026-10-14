import { expect, it } from "vitest";
import {
  academicClock,
  academicMidnight,
  addAcademicDays,
  validCalendarDate,
} from "./academic-clock";
it("uses institutional day at UTC midnight regardless of server timezone", () => {
  expect(academicClock(new Date("2026-10-15T01:00:00Z"))).toEqual({
    date: "2026-10-14",
    weekday: 3,
    minutes: 1320,
  });
  expect(new Date(academicMidnight("2026-10-14")).toISOString()).toBe(
    "2026-10-14T03:00:00.000Z",
  );
});
it("validates calendar dates and handles year rollover", () => {
  expect(validCalendarDate("2026-02-30")).toBe(false);
  expect(validCalendarDate("2028-02-29")).toBe(true);
  expect(addAcademicDays("2026-12-31", 1)).toBe("2027-01-01");
});
it("handles daylight savings offsets in a different configured zone", () => {
  expect(
    new Date(academicMidnight("2026-07-01", "America/New_York")).toISOString(),
  ).toBe("2026-07-01T04:00:00.000Z");
  expect(
    new Date(academicMidnight("2026-12-01", "America/New_York")).toISOString(),
  ).toBe("2026-12-01T05:00:00.000Z");
});
it("interprets a manual deadline in institutional time, rejects impossible local hours", async () => {
  const { academicLocalDateTime, academicDateTimeInput } =
    await import("./academic-clock");
  expect(academicLocalDateTime("2026-10-14T08:00").toISOString()).toBe(
    "2026-10-14T11:00:00.000Z",
  );
  expect(academicDateTimeInput(new Date("2026-10-14T11:00:00Z"))).toBe(
    "2026-10-14T08:00",
  );
  expect(() =>
    academicLocalDateTime("2026-03-08T02:30", "America/New_York"),
  ).toThrow("não existe");
});
