import { redirect } from "next/navigation";

import { SetupForm } from "@/app/setup/setup-form";
import { isSetupRequired } from "@/lib/access";
import { getCurrentSession } from "@/lib/authorization";
import { getTranslations } from "@/lib/translations";
import { defaultUiLanguage, getUiLanguage } from "@/lib/ui-language";

export const dynamic = "force-dynamic";

export default async function SetupPage() {
  if (process.env.OPENSTUDYHUB_V2_ENABLED === "1") redirect("/control/setup");
  if (!isSetupRequired()) redirect("/login");
  if (await getCurrentSession()) redirect("/");

  let language = defaultUiLanguage;
  try {
    language = getUiLanguage();
  } catch {
    // Setup remains available immediately after migrations.
  }
  const { access } = getTranslations(language);

  return (
    <div className="access-screen">
      <header className="access-titlebar">
        <span>{access.setupSystem}</span>
        <div>
          <h1>{access.setupTitle}</h1>
          <p>Crie a primeira conta administrativa desta instância.</p>
        </div>
      </header>
      <SetupForm labels={access} defaultLanguage={language} />
    </div>
  );
}
