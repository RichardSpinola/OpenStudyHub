import { UiCopy } from "@/components/ui-language-provider";
import Link from "next/link";
import type { ReactNode } from "react";
import { logoutAdminAction, logoutUserAction } from "./actions";
import "./console.css";
import { ContextPreserver } from "./context-preserver";
import { getUiLanguage } from "@/lib/ui-language";
export { HiddenContext } from "./hidden-context";
export function ConsoleShell({
  title,
  kicker,
  children,
  admin = false,
  name,
  message,
  error,
  active,
  showNavigation = true,
}: {
  title: string;
  kicker: string;
  children: ReactNode;
  admin?: boolean;
  name?: string;
  message?: string;
  error?: string;
  active?: string;
  showNavigation?: boolean;
}) {
  let english = false;
  try {
    english = getUiLanguage() === "en";
  } catch {
    // The first-installation flow can render before the settings database exists.
  }
  const tr = (pt: string, en: string) => (english ? en : pt);
  const headings: Record<string, string> = {
    Usuários: "Users",
    Instituições: "Institutions",
    "Gestores e permissões": "Managers and permissions",
    Integrações: "Integrations",
    Sistema: "System",
    "Trocar senha temporária": "Change temporary password",
    "ADMINISTRAÇÃO / CONTAS": "ADMINISTRATION / ACCOUNTS",
    "ADMINISTRAÇÃO / INSTITUIÇÕES": "ADMINISTRATION / INSTITUTIONS",
    "ADMINISTRAÇÃO / INSTITUIÇÃO": "ADMINISTRATION / INSTITUTION",
    "ADMINISTRAÇÃO / RESPONSABILIDADES": "ADMINISTRATION / RESPONSIBILITIES",
    "ADMINISTRAÇÃO / INTEGRAÇÕES": "ADMINISTRATION / INTEGRATIONS",
    "ADMINISTRAÇÃO / SISTEMA": "ADMINISTRATION / SYSTEM",
    "Segurança da conta": "Account security",
  };
  const heading = (value: string) =>
    english ? (headings[value] ?? value) : value;
  const feedback: Record<string, string> = {
    "Alteração salva.": "Changes saved.",
    "Sessão expirada. Entre novamente.": "Session expired. Sign in again.",
    "Troque sua senha temporária antes de continuar.":
      "Change your temporary password before continuing.",
    "Ligação com a turma V1 confirmada.": "Link to V1 cohort confirmed.",
    "Envie uma imagem de até 5 MiB.": "Upload an image up to 5 MiB.",
    "Capa da disciplina salva.": "Subject cover saved.",
    "Capa removida. O visual padrão foi restaurado.":
      "Cover removed. Default appearance restored.",
    "Matrícula em lote aplicada integralmente.":
      "Batch enrollment applied in full.",
    "Conta sem vínculos excluída.": "Account without protected links deleted.",
    "Senha redefinida. Compartilhe a senha temporária por um canal seguro.":
      "Password reset. Share the temporary password through a secure channel.",
    "Troca de senha temporária não pendente.":
      "No temporary password change is pending.",
    "Senha alterada. Entre novamente.": "Password changed. Sign in again.",
    "Conjunto de horários inválido.": "Invalid schedule set.",
    "Novo período ativado; histórico preservado.":
      "New period activated; history preserved.",
    "Ação desconhecida.": "Unknown action.",
    "Operação não concluída.": "Operation not completed.",
  };
  const localizeFeedback = (value: string) =>
    english ? (feedback[value] ?? value) : value;
  const navigation = [
    { href: "/control", label: tr("Visão geral", "Overview"), key: "overview" },
    {
      href: "/control/institutions",
      label: tr("Instituições", "Institutions"),
      key: "institutions",
    },
    { href: "/control/users", label: tr("Usuários", "Users"), key: "users" },
    {
      href: "/control/grants",
      label: tr("Gestores e permissões", "Managers and permissions"),
      key: "grants",
    },
    {
      href: "/control/google",
      label: tr("Integrações", "Integrations"),
      key: "integrations",
    },
    { href: "/control/system", label: tr("Sistema", "System"), key: "system" },
    { href: "/control/extras", label: "Extras", key: "extras" },
  ];
  if (admin && name) {
    const links = navigation.map(({ href, label, key }) => (
      <Link
        key={key}
        href={href}
        aria-current={active === key ? "page" : undefined}
      >
        {label}
      </Link>
    ));
    return (
      <div className="admin-workspace">
        <header className="admin-workspace-header">
          <Link href="/control" className="admin-brand">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/icon-32.png" alt="" width="24" height="24" />
            <span>
              OpenStudyHub <strong>Admin</strong>
            </span>
          </Link>
          <span className="admin-identity">{name}</span>
          <form action={logoutAdminAction}>
            <button type="submit">{tr("Sair", "Sign out")}</button>
          </form>
        </header>
        <div className="admin-workspace-body">
          <aside
            className="admin-sidebar"
            aria-label={tr("Administração", "Administration")}
          >
            <p>{tr("ADMINISTRAÇÃO DA INSTÂNCIA", "INSTANCE ADMINISTRATION")}</p>
            <nav
              aria-label={tr("Navegação administrativa", "Admin navigation")}
            >
              {links}
            </nav>
          </aside>
          <div className="admin-workspace-content">
            <details className="admin-mobile-nav">
              <summary>{tr("Áreas da Administração", "Admin areas")}</summary>
              <nav
                aria-label={tr(
                  "Navegação administrativa móvel",
                  "Mobile admin navigation",
                )}
              >
                {navigation.map(({ href, label, key }) => (
                  <Link
                    key={key}
                    href={href}
                    aria-current={active === key ? "page" : undefined}
                  >
                    {label}
                  </Link>
                ))}
              </nav>
            </details>
            <div className="v2-console admin-console">
              <div className="v2-kicker">{heading(kicker)}</div>
              <h1>{heading(title)}</h1>
              {message ? (
                <div className="v2-message" data-type="ok" role="status">
                  {localizeFeedback(message)}
                </div>
              ) : null}
              {error ? (
                <div className="v2-message" data-type="error" role="alert">
                  {localizeFeedback(error)}
                </div>
              ) : null}
              <ContextPreserver>{children}</ContextPreserver>
            </div>
          </div>
        </div>
      </div>
    );
  }
  return (
    <div className="v2-console">
      <div className="v2-kicker">{heading(kicker)}</div>
      <h1>{heading(title)}</h1>
      {name ? (
        <>
          <nav
            className="v2-nav"
            aria-label={tr("Navegação administrativa", "Admin navigation")}
          >
            {showNavigation ? (
              <Link href="/gestao">{tr("Gestão", "Management")}</Link>
            ) : null}
            <form action={admin ? logoutAdminAction : logoutUserAction}>
              <button type="submit">
                {tr("Sair", "Sign out")} · {name}
              </button>
            </form>
          </nav>
        </>
      ) : null}
      {message ? (
        <div className="v2-message" data-type="ok" role="status">
          {localizeFeedback(message)}
        </div>
      ) : null}
      {error ? (
        <div className="v2-message" data-type="error" role="alert">
          {localizeFeedback(error)}
        </div>
      ) : null}
      <ContextPreserver>{children}</ContextPreserver>
    </div>
  );
}
export function Help({ children }: { children: ReactNode }) {
  return (
    <details>
      <summary>
        <UiCopy pt="Ajuda sobre este passo" en="Help with this step" />
      </summary>
      <p>{children}</p>
    </details>
  );
}
