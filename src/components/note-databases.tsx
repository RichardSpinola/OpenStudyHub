"use client";
import { useMemo, useRef, useState, useSyncExternalStore } from "react";
import * as Y from "yjs";
import {
  readNoteDatabases,
  noteStatuses,
  type NoteField,
} from "@/lib/note-databases";
import { NotePanel } from "@/components/note-panel";
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
  const creationDialog = useRef<HTMLDialogElement>(null);
  const [views, setViews] = useState<Record<string, "table" | "board">>(() => {
    try {
      return JSON.parse(
        localStorage.getItem("osh:note-database-views") || "{}",
      );
    } catch {
      return {};
    }
  });
  function changeView(id: string, view: "table" | "board") {
    setViews((previous) => {
      const next = { ...previous, [id]: view };
      try {
        localStorage.setItem(
          "osh:note-database-views",
          JSON.stringify(Object.fromEntries(Object.entries(next).slice(-200))),
        );
      } catch {
        /* View still works without local storage. */
      }
      return next;
    });
  }
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
  function addDatabase(data: FormData) {
    if (!editable) return;
    if (databases.length >= 12) {
      setError(
        tr("Use até 12 bases por página.", "Use up to 12 databases per page."),
      );
      return;
    }
    const name = String(data.get("name") ?? "").trim();
    if (!name) {
      setError(tr("Dê um nome à base.", "Name the database."));
      return;
    }
    const id = crypto.randomUUID(),
      preset = String(data.get("preset"));
    doc.transact(() => {
      map.set(`db:${id}`, name);
      const fields: { name: string; type: NoteField["type"] }[] =
        preset === "tasks"
          ? [{ name: tr("Prazo", "Due date"), type: "date" }]
          : preset === "reading"
            ? [
                { name: tr("Fonte", "Source"), type: "text" },
                { name: tr("Data da leitura", "Reading date"), type: "date" },
              ]
            : [];
      fields.forEach((field) => {
        const fieldId = crypto.randomUUID();
        map.set(
          `field:${id}:${fieldId}`,
          JSON.stringify({ ...field, id: fieldId }),
        );
      });
    }, "local-fields");
    changeView(id, data.get("view") === "board" ? "board" : "table");
    setError("");
    creationDialog.current?.close();
    requestAnimationFrame(() =>
      document
        .getElementById(`note-db-${id}`)
        ?.scrollIntoView({ block: "nearest", behavior: "smooth" }),
    );
  }
  function addRow(id: string, status = "todo") {
    if (!editable) return;
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
    doc.transact(() => {
      map.set(`row:${id}:${row}`, "1");
      map.set(`cell:${id}:${row}:status`, status);
    }, "local-fields");
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
        <section
          className="note-database"
          id={`note-db-${db.id}`}
          key={db.id}
          aria-label={db.name}
        >
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
                onClick={() => changeView(db.id, "table")}
              >
                {tr("Tabela", "Table")}
              </button>
              <button
                type="button"
                aria-pressed={views[db.id] === "board"}
                onClick={() => changeView(db.id, "board")}
              >
                {tr("Quadro", "Board")}
              </button>
            </div>
            <span className="note-muted note-db-count">
              {db.rows.length}{" "}
              {db.rows.length === 1
                ? tr("registro", "record")
                : tr("registros", "records")}
            </span>
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
                  {editable ? (
                    <button
                      type="button"
                      className="note-board-add"
                      onClick={() => addRow(db.id, status)}
                    >
                      + {tr("Novo registro", "New record")}
                    </button>
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
                          <NoteFieldOptions
                            field={f}
                            onRename={(name) =>
                              set(
                                `field:${db.id}:${f.id}`,
                                JSON.stringify({ ...f, name }),
                              )
                            }
                            onRemove={() =>
                              doc.transact(
                                () => map.delete(`field:${db.id}:${f.id}`),
                                "local-fields",
                              )
                            }
                          />
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
              <NotePanel label={tr("Opções da base", "Database options")}>
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
              </NotePanel>
              <NoteFieldAdd
                count={db.fields.length}
                onAdd={(field) =>
                  set(`field:${db.id}:${field.id}`, JSON.stringify(field))
                }
              />
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
        <div className="note-add-database">
          <div>
            <strong>
              {tr("Organize mais nesta página", "Organize more on this page")}
            </strong>
            <p className="note-muted">
              {tr(
                "Uma base reúne registros em tabela ou quadro. Você pode alternar entre as duas visualizações.",
                "A database groups records in a table or board. You can switch between both views.",
              )}
            </p>
          </div>
          <NotePanel
            label={tr("Nova base", "New database")}
            triggerLabel={tr("⊞ Adicionar base", "⊞ Add database")}
            dialogRef={creationDialog}
          >
            <form className="note-create-form" action={addDatabase}>
              <label>
                {tr("Nome da base", "Database name")}
                <input
                  name="name"
                  required
                  maxLength={80}
                  placeholder={tr(
                    "Ex.: Trabalhos do semestre",
                    "E.g. Semester assignments",
                  )}
                  autoFocus
                />
              </label>
              <label>
                {tr("Começar com", "Start with")}
                <select name="preset" defaultValue="blank">
                  <option value="blank">
                    {tr("Base vazia", "Empty database")}
                  </option>
                  <option value="tasks">
                    {tr(
                      "Tarefas · status e prazo",
                      "Tasks · status and due date",
                    )}
                  </option>
                  <option value="reading">
                    {tr("Leituras · fonte e data", "Reading · source and date")}
                  </option>
                </select>
              </label>
              <fieldset className="note-view-choice">
                <legend>{tr("Visualização inicial", "Initial view")}</legend>
                <label>
                  <input
                    type="radio"
                    name="view"
                    value="table"
                    defaultChecked
                  />
                  {tr("Tabela", "Table")}
                </label>
                <label>
                  <input type="radio" name="view" value="board" />
                  {tr("Quadro", "Board")}
                </label>
              </fieldset>
              <p className="note-muted">
                {tr(
                  "Nome e Status já vêm na base. Acrescente os campos que precisar depois.",
                  "Name and Status are included. Add more fields whenever you need them.",
                )}
              </p>
              {error ? (
                <p role="alert" className="form-error">
                  {error}
                </p>
              ) : null}
              <div className="note-dialog-actions">
                <button
                  type="button"
                  onClick={() => creationDialog.current?.close()}
                >
                  {tr("Cancelar", "Cancel")}
                </button>
                <button>{tr("Criar base", "Create database")}</button>
              </div>
            </form>
          </NotePanel>
        </div>
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

function NoteFieldAdd({
  count,
  onAdd,
}: {
  count: number;
  onAdd: (field: NoteField) => void;
}) {
  const tr = useUiText(),
    dialog = useRef<HTMLDialogElement>(null);
  const [error, setError] = useState("");
  return (
    <NotePanel
      label={tr("Adicionar campo", "Add field")}
      triggerLabel={tr("+ Adicionar campo", "+ Add field")}
      dialogRef={dialog}
    >
      <form
        className="note-create-form"
        action={(data) => {
          const name = String(data.get("name") ?? "").trim();
          if (!name) {
            setError(tr("Dê um nome ao campo.", "Name the field."));
            return;
          }
          if (count >= 20) {
            setError(
              tr(
                "Use até 20 campos por base.",
                "Use up to 20 fields per database.",
              ),
            );
            return;
          }
          onAdd({
            id: crypto.randomUUID(),
            name,
            type: data.get("type") as NoteField["type"],
          });
          setError("");
          dialog.current?.close();
        }}
      >
        <label>
          {tr("Nome do campo", "Field name")}
          <input
            name="name"
            required
            maxLength={60}
            autoFocus
            placeholder={tr("Ex.: Entrega", "E.g. Deadline")}
          />
        </label>
        <label>
          {tr("Tipo de informação", "Information type")}
          <select name="type">
            <option value="text">{tr("Texto", "Text")}</option>
            <option value="number">{tr("Número", "Number")}</option>
            <option value="date">{tr("Data", "Date")}</option>
            <option value="checkbox">
              {tr("Caixa de seleção", "Checkbox")}
            </option>
          </select>
        </label>
        {error ? (
          <p className="form-error" role="alert">
            {error}
          </p>
        ) : null}
        <div className="note-dialog-actions">
          <button type="button" onClick={() => dialog.current?.close()}>
            {tr("Cancelar", "Cancel")}
          </button>
          <button>{tr("Adicionar campo", "Add field")}</button>
        </div>
      </form>
    </NotePanel>
  );
}
function NoteFieldOptions({
  field,
  onRename,
  onRemove,
}: {
  field: NoteField;
  onRename: (name: string) => void;
  onRemove: () => void;
}) {
  const tr = useUiText(),
    dialog = useRef<HTMLDialogElement>(null);
  return (
    <NotePanel
      label={tr("Editar campo", "Edit field")}
      triggerLabel={`${field.name} ▾`}
      dialogRef={dialog}
    >
      <form
        className="note-create-form"
        action={(data) => {
          const name = String(data.get("name") ?? "").trim();
          if (!name) return;
          onRename(name);
          dialog.current?.close();
        }}
      >
        <label>
          {tr("Nome do campo", "Field name")}
          <input
            name="name"
            required
            maxLength={60}
            defaultValue={field.name}
          />
        </label>
        <div className="note-dialog-actions">
          <button
            type="button"
            onClick={() => {
              onRemove();
              dialog.current?.close();
            }}
          >
            {tr("Remover campo", "Remove field")}
          </button>
          <button>{tr("Salvar nome", "Save name")}</button>
        </div>
        <p className="note-muted">
          {tr(
            "A remoção pode ser desfeita em Desfazer título ou base.",
            "Removal can be undone with Undo title or database.",
          )}
        </p>
      </form>
    </NotePanel>
  );
}
