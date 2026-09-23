import Link from "next/link";
import { redirect } from "next/navigation";
import { withV2DbAsync, currentUserV2 } from "@/lib/v2/runtime";
import { isSetupPending } from "@/lib/v2/auth";
import { userLoginAction } from "@/app/control/actions";
import { ConsoleShell } from "@/app/control/ui";

export default async function ManagementLogin({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; ok?: string }>;
}) {
  const state = await withV2DbAsync(async (db) => ({
    pending: isSetupPending(db),
    user: await currentUserV2(db),
  }));
  if (state.pending) redirect("/control/setup");
  if (state.user) redirect("/gestao");
  const q = await searchParams;
  return (
    <ConsoleShell
      title="Entrar na Gestão"
      kicker="OpenStudyHub · usuário V2"
      message={q.ok}
      error={q.error}
    >
      <p>Use sua conta normal para acessar os escopos de Gestão concedidos.</p>
      <form action={userLoginAction} className="v2-fields">
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
      <Link href="/">Voltar ao início</Link>
    </ConsoleShell>
  );
}
