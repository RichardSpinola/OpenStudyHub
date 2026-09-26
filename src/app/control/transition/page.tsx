import { redirect } from "next/navigation";
import { withV2DbAsync } from "@/lib/v2/runtime";

export default async function LegacyTransition({
  searchParams,
}: {
  searchParams: Promise<{ program?: string; target?: string }>;
}) {
  const q = await searchParams;
  return withV2DbAsync(async (db) => {
    const course = db
      .prepare(
        "SELECT id,institution_id institutionId FROM programs WHERE id=?",
      )
      .get(Number(q.program)) as
      { id: number; institutionId: number } | undefined;
    if (!course) redirect("/control/institutions");
    const target = Number(q.target);
    redirect(
      `/control/institutions/${course.institutionId}/courses/${course.id}/transition${Number.isSafeInteger(target) && target > 0 ? `?target=${target}` : ""}`,
    );
  });
}
