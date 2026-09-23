import { redirect } from "next/navigation";
import { withV2DbAsync, currentAdminV2 } from "@/lib/v2/runtime";
import { controlAction } from "../actions";
import { ConsoleShell, HiddenContext } from "../ui";
export default async function Password() {
  return withV2DbAsync(async (db) => {
    const user = await currentAdminV2(db);
    if (!user) redirect("/control/login");
    return (
      <ConsoleShell
        title="Trocar senha temporária"
        kicker="Segurança da conta"
        name={user.name}
        admin
      >
        <p>
          Defina uma senha própria antes de continuar. A sessão atual será
          encerrada após a troca.
        </p>
        <form action={controlAction} className="v2-fields">
          <HiddenContext returnTo="/control/login" intent="changeOwnPassword" />
          <label>
            Nova senha
            <input
              type="password"
              name="password"
              minLength={12}
              autoComplete="new-password"
              required
            />
          </label>
          <button>Salvar nova senha</button>
        </form>
      </ConsoleShell>
    );
  });
}
