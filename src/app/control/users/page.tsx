import { redirect } from "next/navigation";
import { withV2DbAsync, currentAdminV2 } from "@/lib/v2/runtime";
import { controlAction } from "../actions";
import { ConsoleShell, HiddenContext, Help } from "../ui";
import { CsvImport } from "./csv-import";
export default async function Users({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const q = await searchParams;
  return withV2DbAsync(async (db) => {
    const actor = await currentAdminV2(db);
    if (!actor) redirect("/control/login");
    if (actor.mustChangePassword) redirect("/control/password");
    const users = db
      .prepare(
        "SELECT id,login,display_name name,active,must_change_password temporary FROM users ORDER BY id DESC LIMIT 200",
      )
      .all() as Array<{
      id: number;
      login: string;
      name: string;
      active: number;
      temporary: number;
    }>;
    return (
      <ConsoleShell
        title="Usuários"
        kicker="Admin · contas e acesso"
        name={actor.name}
        admin
        message={q.ok}
        error={q.error}
      >
        <p>
          Gerencie identidade e acesso. Senhas atuais nunca são mostradas;
          redefinir senha revoga sessões existentes.
        </p>
        <details>
          <summary>Criar usuário</summary>
          <form action={controlAction} className="v2-fields">
            <HiddenContext returnTo="/control/users" intent="user" />
            <label>
              Login
              <input name="login" required />
            </label>
            <label>
              Nome
              <input name="name" required />
            </label>
            <label>
              Senha temporária
              <input
                name="password"
                type="password"
                minLength={12}
                required
                autoComplete="new-password"
              />
            </label>
            <button>Criar conta</button>
          </form>
        </details>
        <div className="v2-table-wrap">
          <table>
            <thead>
              <tr>
                <th>Conta</th>
                <th>Estado</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td>
                    {u.name}
                    <br />
                    <span className="v2-muted">{u.login}</span>
                  </td>
                  <td>
                    {u.active ? "Ativa" : "Desativada"}
                    {u.temporary ? " · troca de senha pendente" : ""}
                  </td>
                  <td>
                    <details>
                      <summary>Gerenciar</summary>
                      <form action={controlAction} className="v2-fields">
                        <HiddenContext
                          returnTo="/control/users"
                          intent="editUser"
                          id={u.id}
                        />
                        <label>
                          Nome
                          <input name="name" defaultValue={u.name} required />
                        </label>
                        <label>
                          Estado
                          <select name="active" defaultValue={String(u.active)}>
                            <option value="1">Ativa</option>
                            <option value="0">Desativada</option>
                          </select>
                        </label>
                        <button>Salvar</button>
                      </form>
                      <form action={controlAction} className="v2-fields">
                        <HiddenContext
                          returnTo="/control/users"
                          intent="password"
                          id={u.id}
                        />
                        <label>
                          Nova senha temporária
                          <input
                            name="password"
                            type="password"
                            minLength={12}
                            required
                          />
                        </label>
                        <button>Redefinir senha</button>
                      </form>
                    </details>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Help>
          Desativar impede login e encerra sessões. Excluir uma conta com
          histórico depende de política de retenção ainda aberta; esta tela
          preserva o usuário e seus vínculos.
        </Help>
        <CsvImport />
      </ConsoleShell>
    );
  });
}
