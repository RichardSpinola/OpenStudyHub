"use client";
import { useActionState } from "react";
import { csvAction, type CsvState } from "../actions";
export function CsvImport() {
  const [state, action, pending] = useActionState(csvAction, {} as CsvState);
  return (
    <section>
      <h2>Importar usuários por CSV</h2>
      <p>
        Cabeçalho: <code>login,nome</code>. Até 1000 linhas. Revise antes de
        aplicar; qualquer linha inválida bloqueia o lote inteiro.
      </p>
      <form action={action}>
        <label>
          Conteúdo CSV
          <textarea
            name="csv"
            defaultValue={state.csv ?? "login,nome\naluno.fake,Aluno Fictício"}
            required
          />
        </label>
        <input type="hidden" name="mode" value="preview" />
        <button disabled={pending}>Pré-visualizar</button>
      </form>
      {state.error ? (
        <div role="alert" className="v2-message" data-type="error">
          {state.error}
        </div>
      ) : null}
      {state.preview ? (
        <>
          <h3>
            Prévia: {state.preview.valid.length} válidos ·{" "}
            {state.preview.errors.length} inválidos
          </h3>
          <div className="v2-table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Linha</th>
                  <th>Login</th>
                  <th>Nome / problema</th>
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
                    <td>Inválida</td>
                    <td>{r.reason}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {state.preview.valid.length > 30 ? (
            <p>Mostrando 30 dos {state.preview.valid.length} válidos.</p>
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
              <button disabled={pending}>Aplicar lote inteiro</button>
            </form>
          ) : null}
        </>
      ) : null}
      {state.credentials ? (
        <div className="v2-message" role="status">
          <strong>{state.credentials.length} contas criadas.</strong>
          <p>
            Senhas temporárias aparecem somente agora; entregue por canal
            seguro. Cada usuário deve alterá-la no primeiro acesso.
          </p>
          <div className="v2-table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Login</th>
                  <th>Senha temporária</th>
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
