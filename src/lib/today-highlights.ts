import type { TodayData } from "@/lib/today";
import type { PersonalClassroomSummary } from "@/lib/v2/classroom-ui";

export function selectTodayHighlights(
  data: TodayData,
  classroom: PersonalClassroomSummary | null,
  now: Date,
) {
  const minutes = now.getHours() * 60 + now.getMinutes();
  const currentOrLater = data.classes
    .filter((item) => item.endsAtMinutes > minutes)
    .sort((a, b) => a.startsAtMinutes - b.startsAtMinutes)[0];
  const nextDay = [...data.upcomingClasses].sort(
    (a, b) =>
      a.date.localeCompare(b.date) || a.startsAtMinutes - b.startsAtMinutes,
  )[0];
  const deadlines = data.activities
    .filter((item) => item.dueAt !== null)
    .sort((a, b) => a.dueAt! - b.dueAt!);
  return {
    lesson: currentOrLater ?? nextDay ?? null,
    lessonIsToday: Boolean(currentOrLater),
    deadline: deadlines[0] ?? null,
    additionalDeadlines: Math.max(0, deadlines.length - 1),
    event: data.upcomingEvents[0] ?? null,
    update: classroom?.updates[0] ?? null,
    nextMeeting: nextDay ?? null,
  };
}
