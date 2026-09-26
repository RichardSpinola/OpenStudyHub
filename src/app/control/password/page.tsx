import { UiCopy } from "@/components/ui-language-provider";
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
          <UiCopy
            pt="Defina uma senha própria antes de continuar. A sessão atual será encerrada após a troca."
            en="Set your own password before continuing. The current session will end after the change."
          />
        </p>
        <form action={controlAction} className="v2-fields">
          <HiddenContext returnTo="/control/login" intent="changeOwnPassword" />
          <label>
            <UiCopy pt="Nova senha" en="New password" />
            <input
              type="password"
              name="password"
              minLength={12}
              autoComplete="new-password"
              required
            />
          </label>
          <button>
            <UiCopy pt="Salvar nova senha" en="Save new password" />
          </button>
        </form>
      </ConsoleShell>
    );
  });
}
