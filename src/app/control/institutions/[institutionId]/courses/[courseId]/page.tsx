import { notFound, redirect } from "next/navigation";
import { withV2DbAsync, currentAdminV2 } from "@/lib/v2/runtime";
import { ManagementPanel } from "@/app/control/management-panel";

export default async function Course({
  params,
  searchParams,
}: {
  params: Promise<{ institutionId: string; courseId: string }>;
  searchParams: Promise<{
    section?: string;
    ok?: string;
    error?: string;
    batchCohort?: string;
    batchOffering?: string;
  }>;
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
    return ManagementPanel({
      db,
      actor,
      name: actor.name,
      admin: true,
      selected: courseId,
      section: q.section ?? "structure",
      contextual: true,
      base: `/control/institutions/${institutionId}/courses/${courseId}`,
      message: q.ok,
      error: q.error,
      batchCohort: Number(q.batchCohort) || 0,
      batchOffering: Number(q.batchOffering) || 0,
    });
  });
}
