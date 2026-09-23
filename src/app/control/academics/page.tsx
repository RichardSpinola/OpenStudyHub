import { redirect } from "next/navigation";
import { withV2DbAsync, currentAdminV2 } from "@/lib/v2/runtime";
import { ManagementPanel } from "../management-panel";
export default async function Academics({
  searchParams,
}: {
  searchParams: Promise<{
    program?: string;
    section?: string;
    ok?: string;
    error?: string;
    batchCohort?: string;
    batchOffering?: string;
  }>;
}) {
  const q = await searchParams;
  return withV2DbAsync(async (db) => {
    const user = await currentAdminV2(db);
    if (!user) redirect("/control/login");
    if (user.mustChangePassword) redirect("/control/password");
    return ManagementPanel({
      db,
      actor: user,
      name: user.name,
      admin: true,
      selected: Number(q.program) || 0,
      section: q.section || "structure",
      base: "/control/academics",
      message: q.ok,
      error: q.error,
      batchCohort: Number(q.batchCohort) || 0,
      batchOffering: Number(q.batchOffering) || 0,
    });
  });
}
