import { redirect } from "next/navigation";
import { withV2DbAsync, currentUserV2 } from "@/lib/v2/runtime";
import { isSetupPending } from "@/lib/v2/auth";

export default async function ManagementLogin() {
  const state = await withV2DbAsync(async (db) => ({
    pending: isSetupPending(db),
    user: await currentUserV2(db),
  }));
  if (state.pending) redirect("/control/setup");
  if (state.user) redirect("/gestao");
  redirect("/login?next=%2Fgestao");
}
