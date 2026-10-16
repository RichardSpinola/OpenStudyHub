import { redirect } from "next/navigation";
import { currentAdminV2, withV2DbAsync } from "./runtime";
export async function requireControlAdmin() {
  return withV2DbAsync(async (db) => {
    const actor = await currentAdminV2(db);
    if (!actor) redirect("/control/login");
    if (actor.mustChangePassword) redirect("/control/password");
    return actor;
  });
}
