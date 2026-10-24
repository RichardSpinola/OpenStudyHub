import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { MFA_COOKIE } from "@/lib/security/admin-mfa";
import { getUiLanguage } from "@/lib/ui-language";
import { verifyMfaAction } from "./actions";
export default async function Verify({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  if (!(await cookies()).get(MFA_COOKIE)) redirect("/control/login");
  const english = getUiLanguage() === "en";
  const t = (pt: string, en: string) => (english ? en : pt);
  return (
    <div className="admin-access">
      <h1>{t("Confirme seu acesso", "Confirm your sign-in")}</h1>
      <p>
        {t(
          "Use o código do autenticador ou um código de recuperação. Você tem cinco minutos e até cinco tentativas.",
          "Use your authenticator or a recovery code. You have five minutes and up to five attempts.",
        )}
      </p>
      {(await searchParams).error && (
        <p role="alert">
          {t(
            "Código inválido, expirado ou já usado. Se necessário, volte ao login e aguarde 15 minutos.",
            "Invalid, expired or already used code. Return to sign-in and wait 15 minutes if needed.",
          )}
        </p>
      )}
      <form action={verifyMfaAction} className="admin-access-form">
        <label>
          {t("Código", "Code")}
          <input
            name="code"
            required
            autoComplete="one-time-code"
            maxLength={100}
            autoFocus
          />
        </label>
        <button>{t("Confirmar", "Confirm")}</button>
      </form>
      <Link href="/control/login">
        {t("Voltar ao login", "Back to sign-in")}
      </Link>
    </div>
  );
}
