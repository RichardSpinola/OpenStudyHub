import Link from "next/link";
import type { ReactNode } from "react";
import { logoutAdminAction, logoutUserAction } from "./actions";
import "./console.css";
export function ConsoleShell({
  title,
  kicker,
  children,
  admin = false,
  name,
  message,
  error,
}: {
  title: string;
  kicker: string;
  children: ReactNode;
  admin?: boolean;
  name?: string;
  message?: string;
  error?: string;
}) {
  return (
    <div className="v2-console">
      <div className="v2-kicker">{kicker}</div>
      <h1>{title}</h1>
      {name ? (
        <>
          <nav className="v2-nav" aria-label="Navegação administrativa">
            <Link href="/gestao">Gestão</Link>
            {admin ? (
              <>
                <Link href="/control">Admin</Link>
                <Link href="/control/academics">Acadêmico</Link>
                <Link href="/control/catalog">Cadastros</Link>
                <Link href="/control/users">Usuários</Link>
                <Link href="/control/grants">Permissões</Link>
                <Link href="/control/transition">Transição</Link>
              </>
            ) : null}
            <form action={admin ? logoutAdminAction : logoutUserAction}>
              <button type="submit">Sair · {name}</button>
            </form>
          </nav>
        </>
      ) : null}
      {message ? (
        <div className="v2-message" data-type="ok" role="status">
          {message}
        </div>
      ) : null}
      {error ? (
        <div className="v2-message" data-type="error" role="alert">
          {error}
        </div>
      ) : null}
      {children}
    </div>
  );
}
export function HiddenContext({
  returnTo,
  ...fields
}: {
  returnTo: string;
  [key: string]: string | number;
}) {
  return (
    <>
      <input type="hidden" name="returnTo" value={returnTo} />
      {Object.entries(fields).map(([key, value]) => (
        <input key={key} type="hidden" name={key} value={value} />
      ))}
    </>
  );
}
export function Help({ children }: { children: ReactNode }) {
  return (
    <details>
      <summary>Ajuda sobre este passo</summary>
      <p>{children}</p>
    </details>
  );
}
