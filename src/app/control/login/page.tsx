import Link from "next/link";
import { redirect } from "next/navigation";
import { withV2DbAsync, currentAdminV2 } from "@/lib/v2/runtime";
import { isSetupPending } from "@/lib/v2/auth";
import { loginAction } from "../actions";
import { ConsoleShell } from "../ui";
export default async function Login({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; ok?: string }>;
}) {
  const state = await withV2DbAsync(async (db) => ({
    pending: isSetupPending(db),
    user: await currentAdminV2(db),
  }));
  if (state.pending) redirect("/control/setup");
  if (state.user) redirect("/control");
  const q = await searchParams;
  return (
    <ConsoleShell
      title="Entrar na administração"
      kicker="OpenStudyHub · acesso V2"
      message={q.ok}
      error={q.error}
    >
      <p>
        Use sua identidade administrativa. Gestores entram com sua conta normal
        na área Gestão.
      </p>
      <form action={loginAction} className="v2-fields">
        <label>
          Login
          <input name="login" autoComplete="username" required />
        </label>
        <label>
          Senha
          <input
            name="password"
            type="password"
            autoComplete="current-password"
            required
          />
        </label>
        <button type="submit">Entrar</button>
      </form>
      <p className="v2-muted">
        A conexão Google não é necessária para administrar a estrutura
        acadêmica.
      </p>
      <Link href="/">Voltar ao início</Link>
      <Link href="/gestao/login">Entrar na Gestão</Link>
    </ConsoleShell>
  );
}
