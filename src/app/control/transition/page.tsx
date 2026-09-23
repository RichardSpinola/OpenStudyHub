import { redirect } from "next/navigation";
import { withV2DbAsync, currentAdminV2 } from "@/lib/v2/runtime";
import { TransitionView } from "./transition-view";
export default async function Transition({
  searchParams,
}: {
  searchParams: Promise<{
    program?: string;
    target?: string;
    ok?: string;
    error?: string;
  }>;
}) {
  const q = await searchParams;
  return withV2DbAsync(async (db) => {
    const user = await currentAdminV2(db);
    if (!user) redirect("/control/login");
    if (user.mustChangePassword) redirect("/control/password");
    return TransitionView({
      db,
      actor: user,
      name: user.name,
      admin: true,
      programId: Number(q.program) || 0,
      targetId: Number(q.target) || 0,
      base: "/control/transition",
      message: q.ok,
      error: q.error,
    });
  });
}
