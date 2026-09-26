import { redirect } from "next/navigation";
import { ConsoleShell } from "../ui";
import { currentAdminV2, withV2DbAsync } from "@/lib/v2/runtime";
import { getExtrasFlags } from "@/lib/v2/extras";
import { ExtrasForm } from "./extras-form";
import "./extras.css";
import { getUiLanguage } from "@/lib/ui-language";

export default async function ControlExtrasPage() {
  return withV2DbAsync(async (db) => {
    const actor = await currentAdminV2(db);
    if (!actor) redirect("/control/login");
    if (actor.mustChangePassword) redirect("/control/password");
    const flags = getExtrasFlags(db);
    const english = getUiLanguage() === "en";
    return (
      <ConsoleShell
        title="Extras"
        kicker={english ? "ADMINISTRATION / EXTRAS" : "ADMINISTRAÇÃO / EXTRAS"}
        name={actor.name}
        admin
        active="extras"
      >
        <ExtrasForm initial={flags} english={english} />
      </ConsoleShell>
    );
  });
}
