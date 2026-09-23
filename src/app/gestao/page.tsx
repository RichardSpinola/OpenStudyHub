import { redirect } from "next/navigation";
import { withV2DbAsync, currentUserV2, currentAdminV2 } from "@/lib/v2/runtime";
import { ManagementPanel } from "../control/management-panel";
export default async function Gestao({
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
    const user = (await currentUserV2(db)) ?? (await currentAdminV2(db));
    if (!user) redirect("/gestao/login");
    if (user.mustChangePassword)
      redirect(
        user.kind === "admin" ? "/control/password" : "/gestao/password",
      );
    return ManagementPanel({
      db,
      actor: user,
      name: user.name,
      admin: user.kind === "admin",
      selected: Number(q.program) || 0,
      section: q.section || "structure",
      base: "/gestao",
      message: q.ok,
      error: q.error,
      batchCohort: Number(q.batchCohort) || 0,
      batchOffering: Number(q.batchOffering) || 0,
    });
  });
}
