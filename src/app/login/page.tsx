import { redirect } from "next/navigation";

import { LoginForm } from "@/app/login/login-form";
import { isSetupRequired } from "@/lib/access";
import { getCurrentSession } from "@/lib/authorization";
import { getTranslations } from "@/lib/translations";
import { defaultUiLanguage, getUiLanguage } from "@/lib/ui-language";

export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const next = (await searchParams).next === "/gestao" ? "/gestao" : null;
  if (process.env.OPENSTUDYHUB_V2_ENABLED !== "1" && isSetupRequired())
    redirect("/setup");
  if (await getCurrentSession()) redirect(next ?? "/");

  let language = defaultUiLanguage;
  try {
    language = getUiLanguage();
  } catch {
    // Login keeps a safe language fallback if the database is unavailable.
  }
  const { access } = getTranslations(language);

  return (
    <div className="access-screen login-screen">
      <header className="login-intro">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/icon-180.png" width="56" height="56" alt="" />
        <span>OpenStudyHub</span>
        <h1>
          {language === "en" ? "Sign in to your account" : "Entre na sua conta"}
        </h1>
      </header>
      <LoginForm
        labels={{
          ...access,
          login: language === "en" ? "Username" : "Usuário",
          password: language === "en" ? "Password" : "Senha",
          loginAction: language === "en" ? "Sign in" : "Entrar",
          sharedComputer: "",
        }}
        next={next}
      />
    </div>
  );
}
