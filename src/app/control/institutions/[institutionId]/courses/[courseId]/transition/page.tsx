import { notFound, redirect } from "next/navigation";
import { currentAdminV2, withV2DbAsync } from "@/lib/v2/runtime";
import { TransitionView } from "@/app/control/transition/transition-view";

export default async function CourseTransition({
  params,
  searchParams,
}: {
  params: Promise<{ institutionId: string; courseId: string }>;
  searchParams: Promise<{ target?: string; ok?: string; error?: string }>;
}) {
  const p = await params;
  const q = await searchParams;
  const institutionId = Number(p.institutionId),
    courseId = Number(p.courseId);
  if (!Number.isSafeInteger(institutionId) || !Number.isSafeInteger(courseId))
    notFound();
  return withV2DbAsync(async (db) => {
    const actor = await currentAdminV2(db);
    if (!actor) redirect("/control/login");
    if (actor.mustChangePassword) redirect("/control/password");
    if (
      !db
        .prepare("SELECT 1 FROM programs WHERE id=? AND institution_id=?")
        .get(courseId, institutionId)
    )
      notFound();
    return TransitionView({
      db,
      actor,
      name: actor.name,
      admin: true,
      programId: courseId,
      targetId: Number(q.target) || 0,
      base: `/control/institutions/${institutionId}/courses/${courseId}/transition`,
      contextual: true,
      message: q.ok,
      error: q.error,
    });
  });
}
