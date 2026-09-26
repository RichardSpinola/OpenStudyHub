import { describe, expect, it } from "vitest";
import type { TodayData } from "./today";
import { selectTodayHighlights } from "./today-highlights";

describe("Today summary", () => {
  it("uses the next real meeting when today's lessons have ended and chooses the earliest deadline", () => {
    const now = new Date(2026, 8, 23, 14, 0);
    const data = {
      classes: [
        {
          startsAtMinutes: 8 * 60,
          endsAtMinutes: 10 * 60,
          subjectName: "Aula antiga",
        },
      ],
      upcomingClasses: [
        {
          date: "2026-09-24",
          startsAtMinutes: 10 * 60,
          endsAtMinutes: 12 * 60,
          subjectName: "Próxima aula",
        },
      ],
      activities: [
        { title: "Prazo distante", dueAt: now.getTime() + 172800000 },
        { title: "Prazo próximo", dueAt: now.getTime() + 3600000 },
      ],
      upcomingEvents: [],
    } as unknown as TodayData;
    const result = selectTodayHighlights(data, null, now);
    expect(result.lesson?.subjectName).toBe("Próxima aula");
    expect(result.lessonIsToday).toBe(false);
    expect(result.deadline?.title).toBe("Prazo próximo");
    expect(result.additionalDeadlines).toBe(1);
  });
});
