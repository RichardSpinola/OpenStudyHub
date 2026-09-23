import { redirect } from "next/navigation";

import { LoginForm } from "@/app/login/login-form";
import { isSetupRequired } from "@/lib/access";
import { getCurrentSession } from "@/lib/authorization";
import { getTranslations } from "@/lib/translations";
import { defaultUiLanguage, getUiLanguage } from "@/lib/ui-language";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  if (process.env.OPENSTUDYHUB_V2_ENABLED !== "1" && isSetupRequired())
    redirect("/setup");
  if (await getCurrentSession()) redirect("/");

  let language = defaultUiLanguage;
  try {
    language = getUiLanguage();
  } catch {
    // Login keeps a safe language fallback if the database is unavailable.
  }
  const { access } = getTranslations(language);

  return (
    <div className="access-screen login-screen">
      <header className="access-titlebar">
        <span>{access.loginSystem}</span>
        <div>
          <h1>{access.loginTitle}</h1>
          <p>Acesse seu espaço acadêmico.</p>
        </div>
      </header>
      <LoginForm labels={access} />
    </div>
  );
}
