import { UiCopy } from "@/components/ui-language-provider";
import Link from "next/link";
import { redirect } from "next/navigation";
import { currentAdminV2, withV2DbAsync } from "@/lib/v2/runtime";
import { previewDeleteV2User } from "@/lib/v2/users";
import { controlAction } from "../actions";
import { AdminActionPanel } from "../admin-action-panel";
import { ConsoleShell, HiddenContext } from "../ui";
import { CsvImport } from "./csv-import";
import { getUiLanguage } from "@/lib/ui-language";
import { uiText } from "@/lib/translations";

export default async function Users({
  searchParams,
}: {
  searchParams: Promise<{
    ok?: string;
    error?: string;
    query?: string;
    status?: string;
    user?: string;
  }>;
}) {
  const q = await searchParams;
  return withV2DbAsync(async (db) => {
    const language = getUiLanguage();
    const tr = (pt: string, en: string) => uiText(language, pt, en);
    const actor = await currentAdminV2(db);
    if (!actor) redirect("/control/login");
    if (actor.mustChangePassword) redirect("/control/password");
    const query = (q.query ?? "").trim().slice(0, 80);
    const status =
      q.status === "active" || q.status === "inactive" ? q.status : "all";
    const users = db
      .prepare(
        `SELECT id,login,display_name name,active,must_change_password temporary FROM users
      WHERE (login LIKE ? ESCAPE '\\' OR display_name LIKE ? ESCAPE '\\') AND (?='all' OR active=?)
      ORDER BY display_name LIMIT 200`,
      )
      .all(
        ...[
          `%${query.replace(/[\\%_]/g, "\\$&")}%`,
          `%${query.replace(/[\\%_]/g, "\\$&")}%`,
          status,
          status === "active" ? 1 : 0,
        ],
      ) as Array<{
      id: number;
      login: string;
      name: string;
      active: number;
      temporary: number;
    }>;
    const selected = users.find((user) => user.id === Number(q.user));
    const deletion = selected
      ? previewDeleteV2User(db, actor, selected.id)
      : null;
    const current = new URLSearchParams();
    if (query) current.set("query", query);
    if (status !== "all") current.set("status", status);
    if (selected) current.set("user", String(selected.id));
    const returnTo = `/control/users${current.size ? `?${current}` : ""}`;
    return (
      <ConsoleShell
        title="Usuários"
        kicker="ADMINISTRAÇÃO / CONTAS"
        name={actor.name}
        admin
        active="users"
        message={q.ok}
        error={q.error}
      >
        <div className="admin-section-header">
          <p>
            <UiCopy
              pt="Encontre uma conta e escolha a ação necessária."
              en="Find an account and choose an action."
            />
          </p>
          <AdminActionPanel title="Criar usuário">
            <form action={controlAction} className="v2-fields">
              <HiddenContext returnTo="/control/users" intent="user" />
              <label>
                Login
                <input name="login" required />
              </label>
              <label>
                <UiCopy pt="Nome" en="Name" />
                <input name="name" required />
              </label>
              <label>
                <UiCopy pt="Senha temporária" en="Temporary password" />
                <input
                  name="password"
                  type="password"
                  minLength={12}
                  required
                  autoComplete="new-password"
                />
              </label>
              <button>
                <UiCopy pt="Criar conta" en="Create account" />
              </button>
            </form>
          </AdminActionPanel>
        </div>
        <form
          action="/control/users"
          method="get"
          className="admin-user-search"
        >
          <label>
            <UiCopy
              pt="Buscar por nome ou login"
              en="Search by name or login"
            />
            <input name="query" defaultValue={query} />
          </label>
          <label>
            <UiCopy pt="Estado" en="Status" />
            <select name="status" defaultValue={status}>
              <option value="all">
                <UiCopy pt="Todos" en="All" />
              </option>
              <option value="active">
                <UiCopy pt="Ativos" en="Active" />
              </option>
              <option value="inactive">
                <UiCopy pt="Desativados" en="Disabled" />
              </option>
            </select>
          </label>
          <button>
            <UiCopy pt="Filtrar" en="Filter" />
          </button>
        </form>
        <div className="v2-table-wrap">
          <table>
            <thead>
              <tr>
                <th>
                  <UiCopy pt="Pessoa" en="Person" />
                </th>
                <th>
                  <UiCopy pt="Estado" en="Status" />
                </th>
                <th>
                  <UiCopy pt="Ação" en="Action" />
                </th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => {
                const params = new URLSearchParams(current);
                params.set("user", String(user.id));
                return (
                  <tr key={user.id}>
                    <td>
                      <strong>{user.name}</strong>
                      <br />
                      <span className="v2-muted">{user.login}</span>
                    </td>
                    <td>
                      {user.active
                        ? tr("Ativa", "Active")
                        : tr("Desativada", "Disabled")}
                      {user.temporary
                        ? tr(" · senha temporária", " · temporary password")
                        : ""}
                    </td>
                    <td>
                      <Link href={`/control/users?${params}`}>
                        <UiCopy pt="Gerenciar" en="Manage" />
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {!users.length ? (
          <p>
            <UiCopy pt="Nenhuma conta encontrada." en="No accounts found." />
          </p>
        ) : null}
        {selected && deletion ? (
          <section className="admin-selected-account">
            <h2>{selected.name}</h2>
            <p>
              <UiCopy pt="Login:" en="Username:" /> {selected.login} ·{" "}
              {selected.active
                ? tr("conta ativa", "active account")
                : tr("conta desativada", "disabled account")}
            </p>
            <div className="admin-account-actions">
              <AdminActionPanel title="Editar conta">
                <form action={controlAction} className="v2-fields">
                  <HiddenContext
                    returnTo={returnTo}
                    intent="editUser"
                    id={selected.id}
                  />
                  <label>
                    <UiCopy pt="Nome" en="Name" />
                    <input name="name" defaultValue={selected.name} required />
                  </label>
                  <label>
                    <UiCopy pt="Estado" en="Status" />
                    <select
                      name="active"
                      defaultValue={String(selected.active)}
                    >
                      <option value="1">
                        <UiCopy pt="Ativa" en="Active" />
                      </option>
                      <option value="0">
                        <UiCopy pt="Desativada" en="Disabled" />
                      </option>
                    </select>
                  </label>
                  <button>
                    <UiCopy pt="Salvar" en="Save" />
                  </button>
                </form>
              </AdminActionPanel>
              <AdminActionPanel title="Redefinir senha">
                <form action={controlAction} className="v2-fields">
                  <HiddenContext
                    returnTo={returnTo}
                    intent="password"
                    id={selected.id}
                  />
                  <label>
                    <UiCopy
                      pt="Nova senha temporária"
                      en="New temporary password"
                    />
                    <input
                      name="password"
                      type="password"
                      minLength={12}
                      required
                      autoComplete="new-password"
                    />
                  </label>
                  <button>
                    <UiCopy
                      pt="Redefinir senha e encerrar sessões"
                      en="Reset password and end sessions"
                    />
                  </button>
                </form>
              </AdminActionPanel>
              <form action={controlAction}>
                <HiddenContext
                  returnTo={returnTo}
                  intent="editUser"
                  id={selected.id}
                />
                <input type="hidden" name="name" value={selected.name} />
                <input
                  type="hidden"
                  name="active"
                  value={selected.active ? "0" : "1"}
                />
                <button>
                  {selected.active
                    ? tr("Desativar", "Disable")
                    : tr("Reativar", "Reactivate")}
                </button>
              </form>
              <AdminActionPanel title="Excluir conta">
                <p>
                  {deletion.canDelete
                    ? tr(
                        "Esta conta não possui vínculos protegidos e pode ser excluída.",
                        "This account has no protected links and can be deleted.",
                      )
                    : tr(
                        `Esta conta possui ${deletion.dependencies.reduce((sum, item) => sum + item.count, 0)} vínculo(s) que impedem a exclusão. Desative a conta para impedir o acesso.`,
                        `This account has ${deletion.dependencies.reduce((sum, item) => sum + item.count, 0)} protected link(s) that prevent deletion. Disable it to block access.`,
                      )}
                </p>
                {deletion.canDelete ? (
                  <form action={controlAction} className="v2-fields">
                    <HiddenContext
                      returnTo="/control/users"
                      intent="deleteUser"
                      id={selected.id}
                    />
                    <label>
                      <UiCopy pt="Digite" en="Type" /> {selected.login}
                      <UiCopy pt="para confirmar" en="to confirm" />
                      <input name="confirmation" autoComplete="off" required />
                    </label>
                    <button className="v2-danger">
                      <UiCopy
                        pt="Excluir definitivamente"
                        en="Delete permanently"
                      />
                    </button>
                  </form>
                ) : null}
              </AdminActionPanel>
            </div>
          </section>
        ) : null}
        <CsvImport />
      </ConsoleShell>
    );
  });
}
