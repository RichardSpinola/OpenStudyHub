import { redirect } from "next/navigation";
import { withV2DbAsync, currentUserV2, currentAdminV2 } from "@/lib/v2/runtime";
import { TransitionView } from "../../control/transition/transition-view";
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
    const user = (await currentUserV2(db)) ?? (await currentAdminV2(db));
    if (!user) redirect("/gestao/login");
    if (user.mustChangePassword)
      redirect(
        user.kind === "admin" ? "/control/password" : "/gestao/password",
      );
    return TransitionView({
      db,
      actor: user,
      name: user.name,
      admin: user.kind === "admin",
      programId: Number(q.program) || 0,
      targetId: Number(q.target) || 0,
      base: "/gestao/transition",
      message: q.ok,
      error: q.error,
    });
  });
}
