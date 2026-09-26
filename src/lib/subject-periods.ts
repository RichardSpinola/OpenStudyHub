import type { SubjectOfferingSummary } from "@/lib/academic";

export function partitionOfferingsByPeriod(
  offerings: SubjectOfferingSummary[],
  currentLabel: string | null,
) {
  const current = offerings.filter((item) => item.periodLabel === currentLabel);
  const history = new Map<string, SubjectOfferingSummary[]>();
  for (const item of offerings) {
    if (item.periodLabel === currentLabel) continue;
    const group = history.get(item.periodLabel) ?? [];
    group.push(item);
    history.set(item.periodLabel, group);
  }
  return { current, history };
}
