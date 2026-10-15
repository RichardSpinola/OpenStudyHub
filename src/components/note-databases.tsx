"use client";
import { useMemo, useState, useSyncExternalStore } from "react";
import * as Y from "yjs";
import {
  readNoteDatabases,
  noteStatuses,
  type NoteField,
} from "@/lib/note-databases";
import { useUiText } from "@/components/ui-language-provider";

export function NoteDatabases({
  doc,
  editable,
}: {
  doc: Y.Doc;
  editable: boolean;
}) {
  const tr = useUiText();
  const map = doc.getMap<string>("database");
  const subscribe = (fn: () => void) => {
    map.observe(fn);
    return () => map.unobserve(fn);
  };
  const raw = useSyncExternalStore(
    subscribe,
    () => JSON.stringify(map.toJSON()),
    () => "{}",
  );
  const databases = useMemo(() => readNoteDatabases(JSON.parse(raw)), [raw]);
  const [views, setViews] = useState<Record<string, "table" | "board">>({});
  const [error, setError] = useState("");
  const statusLabel = (status: string) =>
    status === "done"
      ? tr("Concluído", "Done")
      : status === "doing"
        ? tr("Em andamento", "In progress")
        : tr("A fazer", "To do");
  function set(key: string, value: string) {
    if (editable) doc.transact(() => map.set(key, value), "local-fields");
  }
  function addDatabase() {
    if (databases.length >= 12) {
      setError(
        tr("Use até 12 bases por página.", "Use up to 12 databases per page."),
      );
      return;
    }
    const id = crypto.randomUUID();
    set(`db:${id}`, tr("Minha base", "My database"));
    setViews((v) => ({ ...v, [id]: "table" }));
  }
  function addRow(id: string) {
    const db = databases.find((d) => d.id === id);
    if (!db || db.rows.length >= 300) {
      setError(
        tr(
          "Use até 300 registros por base.",
          "Use up to 300 records per database.",
        ),
      );
      return;
    }
    const row = crypto.randomUUID();
    set(`row:${id}:${row}`, "1");
    requestAnimationFrame(() =>
      document
        .querySelector<HTMLInputElement>(`[data-note-row="${row}"]`)
        ?.focus(),
    );
  }
  return (
    <section
      className="note-databases"
      aria-label={tr("Bases da página", "Page databases")}
    >
      {databases.map((db) => (
        <section className="note-database" key={db.id} aria-label={db.name}>
          <header>
            <input
              aria-label={tr("Nome da base", "Database name")}
              maxLength={80}
              value={db.name}
              readOnly={!editable}
              onChange={(e) => set(`db:${db.id}`, e.target.value)}
            />
            <div
              className="note-view-switch"
              role="group"
              aria-label={tr("Visualização da base", "Database view")}
            >
              <button
                type="button"
                aria-pressed={views[db.id] !== "board"}
                onClick={() => setViews((v) => ({ ...v, [db.id]: "table" }))}
              >
                {tr("Tabela", "Table")}
              </button>
              <button
                type="button"
                aria-pressed={views[db.id] === "board"}
                onClick={() => setViews((v) => ({ ...v, [db.id]: "board" }))}
              >
                {tr("Quadro", "Board")}
              </button>
            </div>
          </header>
          {views[db.id] === "board" ? (
            <div className="note-kanban">
              {noteStatuses.map((status) => (
                <section
                  key={status}
                  onDragOver={(e) => {
                    if (editable) e.preventDefault();
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    if (!editable) return;
                    const row = e.dataTransfer.getData(
                      "application/osh-note-row",
                    );
                    if (db.rows.some((r) => r.id === row))
                      set(`cell:${db.id}:${row}:status`, status);
                  }}
                >
                  <h3>
                    {statusLabel(status)}{" "}
                    <small>
                      {db.rows.filter((r) => r.status === status).length}
                    </small>
                  </h3>
                  {db.rows
                    .filter((r) => r.status === status)
                    .map((row) => (
                      <article key={row.id} className="note-kanban-card">
                        {editable ? (
                          <button
                            className="note-drag-handle"
                            type="button"
                            draggable
                            onDragStart={(e) =>
                              e.dataTransfer.setData(
                                "application/osh-note-row",
                                row.id,
                              )
                            }
                            aria-label={tr("Arrastar registro", "Drag record")}
                            title={tr(
                              "Arraste ou use o campo Status",
                              "Drag or use the Status field",
                            )}
                          >
                            ⠿
                          </button>
                        ) : null}
                        <input
                          aria-label={tr("Nome do registro", "Record name")}
                          data-note-row={row.id}
                          value={row.name}
                          readOnly={!editable}
                          placeholder={tr("Sem título", "Untitled")}
                          maxLength={200}
                          onChange={(e) =>
                            set(`cell:${db.id}:${row.id}:name`, e.target.value)
                          }
                        />
                        <select
                          aria-label={tr("Status do registro", "Record status")}
                          disabled={!editable}
                          value={row.status}
                          onChange={(e) =>
                            set(
                              `cell:${db.id}:${row.id}:status`,
                              e.target.value,
                            )
                          }
                        >
                          {noteStatuses.map((s) => (
                            <option key={s} value={s}>
                              {statusLabel(s)}
                            </option>
                          ))}
                        </select>
                        {db.fields.map((field) => (
                          <label key={field.id}>
                            {field.name}
                            <DatabaseCell
                              field={field}
                              value={row.cells[field.id] ?? ""}
                              editable={editable}
                              onChange={(value) =>
                                set(
                                  `cell:${db.id}:${row.id}:${field.id}`,
                                  value,
                                )
                              }
                            />
                          </label>
                        ))}
                      </article>
                    ))}
                  {!db.rows.some((r) => r.status === status) ? (
                    <p className="note-muted">
                      {tr("Nenhum registro", "No records")}
                    </p>
                  ) : null}
                </section>
              ))}
            </div>
          ) : (
            <div
              className="note-table-scroll"
              tabIndex={0}
              aria-label={tr(
                "Tabela com rolagem horizontal",
                "Horizontally scrollable table",
              )}
            >
              <table>
                <thead>
                  <tr>
                    <th>{tr("Nome", "Name")}</th>
                    <th>Status</th>
                    {db.fields.map((f) => (
                      <th key={f.id}>
                        {editable ? (
                          <details className="note-field-options">
                            <summary>{f.name}</summary>
                            <label>
                              {tr("Nome do campo", "Field name")}
                              <input
                                value={f.name}
                                maxLength={60}
                                onChange={(e) => {
                                  if (e.target.value.trim())
                                    set(
                                      `field:${db.id}:${f.id}`,
                                      JSON.stringify({
                                        ...f,
                                        name: e.target.value,
                                      }),
                                    );
                                }}
                              />
                            </label>
                            <button
                              type="button"
                              onClick={() =>
                                doc.transact(
                                  () => map.delete(`field:${db.id}:${f.id}`),
                                  "local-fields",
                                )
                              }
                            >
                              {tr("Remover campo", "Remove field")}
                            </button>
                          </details>
                        ) : (
                          f.name
                        )}
                      </th>
                    ))}
                    {editable ? (
                      <th>
                        <span className="note-muted">
                          {tr("Ações", "Actions")}
                        </span>
                      </th>
                    ) : null}
                  </tr>
                </thead>
                <tbody>
                  {db.rows.map((row) => (
                    <tr key={row.id}>
                      <td>
                        <input
                          aria-label={tr("Nome do registro", "Record name")}
                          data-note-row={row.id}
                          value={row.name}
                          readOnly={!editable}
                          placeholder={tr("Sem título", "Untitled")}
                          maxLength={200}
                          onChange={(e) =>
                            set(`cell:${db.id}:${row.id}:name`, e.target.value)
                          }
                        />
                      </td>
                      <td>
                        <select
                          aria-label={tr("Status do registro", "Record status")}
                          value={row.status}
                          disabled={!editable}
                          onChange={(e) =>
                            set(
                              `cell:${db.id}:${row.id}:status`,
                              e.target.value,
                            )
                          }
                        >
                          {noteStatuses.map((s) => (
                            <option key={s} value={s}>
                              {statusLabel(s)}
                            </option>
                          ))}
                        </select>
                      </td>
                      {db.fields.map((field) => (
                        <td key={field.id}>
                          <DatabaseCell
                            field={field}
                            value={row.cells[field.id] ?? ""}
                            editable={editable}
                            onChange={(value) =>
                              set(`cell:${db.id}:${row.id}:${field.id}`, value)
                            }
                          />
                        </td>
                      ))}
                      {editable ? (
                        <td>
                          <button
                            type="button"
                            aria-label={`${tr("Remover registro", "Remove record")} ${row.name}`}
                            onClick={() =>
                              doc.transact(
                                () => map.delete(`row:${db.id}:${row.id}`),
                                "local-fields",
                              )
                            }
                          >
                            ×
                          </button>
                        </td>
                      ) : null}
                    </tr>
                  ))}
                </tbody>
              </table>
              {!db.rows.length ? (
                <p className="note-muted">
                  {tr(
                    "Adicione um registro para começar. Você pode alternar para Quadro a qualquer momento.",
                    "Add a record to start. You can switch to Board at any time.",
                  )}
                </p>
              ) : null}
            </div>
          )}
          {editable ? (
            <footer>
              <button type="button" onClick={() => addRow(db.id)}>
                + {tr("Novo registro", "New record")}
              </button>
              <details>
                <summary>{tr("Opções da base", "Database options")}</summary>
                <p className="note-muted">
                  {tr(
                    "Remover pode ser desfeito em Desfazer título ou base.",
                    "Removal can be undone with Undo title or database.",
                  )}
                </p>
                <button
                  type="button"
                  onClick={() =>
                    doc.transact(
                      () => map.delete(`db:${db.id}`),
                      "local-fields",
                    )
                  }
                >
                  {tr("Remover base desta página", "Remove database from page")}
                </button>
              </details>
              <details>
                <summary>+ {tr("Adicionar campo", "Add field")}</summary>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    const form = e.currentTarget;
                    const data = new FormData(form);
                    const name = String(data.get("name") ?? "").trim();
                    if (!name) return;
                    if (db.fields.length >= 20) {
                      setError(
                        tr(
                          "Use até 20 campos por base.",
                          "Use up to 20 fields per database.",
                        ),
                      );
                      return;
                    }
                    const id = crypto.randomUUID();
                    set(
                      `field:${db.id}:${id}`,
                      JSON.stringify({ id, name, type: data.get("type") }),
                    );
                    form.reset();
                    form.closest("details")?.removeAttribute("open");
                  }}
                >
                  <label>
                    {tr("Nome do campo", "Field name")}
                    <input name="name" required maxLength={60} />
                  </label>
                  <label>
                    {tr("Tipo", "Type")}
                    <select name="type">
                      <option value="text">{tr("Texto", "Text")}</option>
                      <option value="number">{tr("Número", "Number")}</option>
                      <option value="date">{tr("Data", "Date")}</option>
                      <option value="checkbox">
                        {tr("Caixa de seleção", "Checkbox")}
                      </option>
                    </select>
                  </label>
                  <button>{tr("Adicionar", "Add")}</button>
                </form>
              </details>
            </footer>
          ) : null}
        </section>
      ))}
      {error ? (
        <p role="alert" className="form-error">
          {error}
        </p>
      ) : null}
      {editable ? (
        <button
          type="button"
          className="note-add-database"
          onClick={addDatabase}
        >
          ⊞{" "}
          {tr(
            "Adicionar base · tabela ou quadro",
            "Add database · table or board",
          )}
        </button>
      ) : null}
    </section>
  );
}
function DatabaseCell({
  field,
  value,
  editable,
  onChange,
}: {
  field: NoteField;
  value: string;
  editable: boolean;
  onChange: (v: string) => void;
}) {
  return field.type === "checkbox" ? (
    <input
      type="checkbox"
      aria-label={field.name}
      checked={value === "true"}
      disabled={!editable}
      onChange={(e) => onChange(String(e.target.checked))}
    />
  ) : (
    <input
      type={field.type}
      aria-label={field.name}
      value={value}
      readOnly={!editable}
      maxLength={2000}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}
