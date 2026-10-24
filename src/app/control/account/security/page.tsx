import { requireControlAdmin } from "@/lib/v2/control-auth";
import { withV2Db } from "@/lib/v2/runtime";
import { mfaState } from "@/lib/security/admin-mfa";
import { getUiLanguage } from "@/lib/ui-language";
import { ConsoleShell } from "../../ui";
import { SecurityForm } from "./security-form";
export default async function Security() {
  const actor = await requireControlAdmin();
  const enabled = withV2Db((db) => !!mfaState(db, actor.id)?.enabled_at);
  const english = getUiLanguage() === "en";
  return (
    <ConsoleShell
      admin
      name={actor.name}
      active="security"
      title={english ? "My account · Security" : "Minha conta · Segurança"}
      kicker="OpenStudyHub Admin"
    >
      <SecurityForm enabled={enabled} english={english} />
    </ConsoleShell>
  );
}
