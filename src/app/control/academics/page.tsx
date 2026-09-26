import { redirect } from "next/navigation";
import { withV2DbAsync } from "@/lib/v2/runtime";

export default async function Academics({
  searchParams,
}: {
  searchParams: Promise<{ program?: string; section?: string }>;
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
    const section = [
      "structure",
      "curriculum",
      "offerings",
      "schedule",
      "enrollments",
    ].includes(q.section ?? "")
      ? `?section=${q.section}`
      : "";
    redirect(
      `/control/institutions/${course.institutionId}/courses/${course.id}${section}`,
    );
  });
}
