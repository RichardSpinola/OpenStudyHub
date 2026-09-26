import { describe, expect, it } from "vitest";
import type { SubjectOfferingSummary } from "@/lib/academic";
import { partitionOfferingsByPeriod } from "./subject-periods";

describe("period grouping", () => {
  it("separates the current period from arbitrarily many historical periods", () => {
    const base = {
      offeringId: 1,
      subjectId: 1,
      subjectCode: null,
      subjectName: "Fictícia",
      subjectShortName: null,
      programName: "Demo",
      programShortName: null,
      instructorName: null,
      classGroup: null,
      curriculumTerm: null,
      status: "active" as const,
    };
    const offerings = ["2026.2", "2026.1", "2025.2", "2025.1"].map(
      (periodLabel, index) => ({ ...base, offeringId: index + 1, periodLabel }),
    ) satisfies SubjectOfferingSummary[];
    const grouped = partitionOfferingsByPeriod(offerings, "2026.2");
    expect(grouped.current).toHaveLength(1);
    expect([...grouped.history.keys()]).toEqual(["2026.1", "2025.2", "2025.1"]);
  });
});
