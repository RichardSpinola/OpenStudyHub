"use client";
import { UiCopy } from "@/components/ui-language-provider";

import { useActionState } from "react";
import { csvAction, type CsvState } from "../actions";
export function CsvImport() {
  const [state, action, pending] = useActionState(csvAction, {} as CsvState);
  return (
    <section>
      <h2>
        <UiCopy pt="Importar usuários por CSV" en="Import users from CSV" />
      </h2>
      <p>
        <UiCopy pt="Cabeçalho:" en="Header:" />
        <code>login,nome</code>
        <UiCopy
          pt=". Até 1000 linhas. Revise antes de aplicar; qualquer linha inválida bloqueia o lote inteiro."
          en=". Up to 1000 rows. Review before applying; any invalid row blocks the entire batch."
        />
      </p>
      <form action={action}>
        <label>
          <UiCopy pt="Conteúdo CSV" en="CSV content" />
          <textarea
            name="csv"
            defaultValue={state.csv ?? "login,nome"}
            required
          />
        </label>
        <input type="hidden" name="mode" value="preview" />
        <button disabled={pending}>
          <UiCopy pt="Pré-visualizar" en="Preview" />
        </button>
      </form>
      {state.error ? (
        <div role="alert" className="v2-message" data-type="error">
          {state.error}
        </div>
      ) : null}
      {state.preview ? (
        <>
          <h3>
            <UiCopy pt="Prévia:" en="Preview:" /> {state.preview.valid.length}
            <UiCopy pt="válidos ·" en="valid ·" /> {state.preview.errors.length}
            <UiCopy pt="inválidos" en="invalid" />
          </h3>
          <div className="v2-table-wrap">
            <table>
              <thead>
                <tr>
                  <th>
                    <UiCopy pt="Linha" en="Row" />
                  </th>
                  <th>Login</th>
                  <th>
                    <UiCopy pt="Nome / problema" en="Name / issue" />
                  </th>
                </tr>
              </thead>
              <tbody>
                {state.preview.valid.slice(0, 30).map((r) => (
                  <tr key={r.line}>
                    <td>{r.line}</td>
                    <td>{r.login}</td>
                    <td>{r.name}</td>
                  </tr>
                ))}
                {state.preview.errors.map((r) => (
                  <tr key={r.line}>
                    <td>{r.line}</td>
                    <td>
                      <UiCopy pt="Inválida" en="Invalid" />
                    </td>
                    <td>{r.reason}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {state.preview.valid.length > 30 ? (
            <p>
              <UiCopy pt="Mostrando 30 dos" en="Showing 30 of" />{" "}
              {state.preview.valid.length}
              <UiCopy pt="válidos." en="valid." />
            </p>
          ) : null}
          {!state.preview.errors.length && state.preview.valid.length ? (
            <form action={action}>
              <input type="hidden" name="mode" value="apply" />
              <input type="hidden" name="csv" value={state.csv ?? ""} />
              <input
                type="hidden"
                name="fingerprint"
                value={state.preview.fingerprint}
              />
              <button disabled={pending}>
                <UiCopy pt="Aplicar lote inteiro" en="Apply entire batch" />
              </button>
            </form>
          ) : null}
        </>
      ) : null}
      {state.credentials ? (
        <div className="v2-message" role="status">
          <strong>
            {state.credentials.length}
            <UiCopy pt="contas criadas." en="accounts created." />
          </strong>
          <p>
            <UiCopy
              pt="Senhas temporárias aparecem somente agora; entregue por canal seguro. Cada usuário deve alterá-la no primeiro acesso."
              en="Temporary passwords are shown only now; send them through a secure channel. Each user must change theirs at first sign-in."
            />
          </p>
          <div className="v2-table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Login</th>
                  <th>
                    <UiCopy pt="Senha temporária" en="Temporary password" />
                  </th>
                </tr>
              </thead>
              <tbody>
                {state.credentials.map((c) => (
                  <tr key={c.login}>
                    <td>{c.login}</td>
                    <td>
                      <code>{c.temporaryPassword}</code>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </section>
  );
}
