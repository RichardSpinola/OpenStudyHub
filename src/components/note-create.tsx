"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { NotePanel } from "@/components/note-panel";
import { useUiText } from "@/components/ui-language-provider";
import { createWorkspacePageAction } from "@/app/notes/actions";
import { notePageTemplates } from "@/lib/note-page-templates";
export function NoteCreate({
  parents = [],
  parentId,
  offeringId,
  activityId,
  offerings = [],
  subpage = false,
}: {
  parents?: { id: number; title: string }[];
  parentId?: number;
  offeringId?: number | string | null;
  activityId?: number | string | null;
  offerings?: {
    offeringId: number;
    subjectName: string;
    periodLabel: string;
  }[];
  subpage?: boolean;
}) {
  const tr = useUiText(),
    router = useRouter(),
    dialog = useRef<HTMLDialogElement>(null);
  const [template, setTemplate] = useState("blank"),
    [pending, setPending] = useState(false),
    [error, setError] = useState("");
  const labels = {
    blank: [
      tr("Página em branco", "Blank page"),
      tr("Escreva do seu jeito.", "Start with your own ideas."),
    ],
    lecture: [
      tr("Anotações de aula", "Class notes"),
      tr("Ideias, anotações e revisão.", "Ideas, notes and review."),
    ],
    meeting: [
      tr("Reunião", "Meeting"),
      tr(
        "Pauta, decisões e próximos passos.",
        "Agenda, decisions and next steps.",
      ),
    ],
  };
  return (
    <NotePanel
      dialogRef={dialog}
      busy={pending}
      label={
        subpage
          ? tr("Nova subpágina", "New subpage")
          : tr("Nova página", "New page")
      }
      triggerLabel={
        subpage
          ? tr("+ Nova subpágina", "+ New subpage")
          : tr("+ Nova página", "+ New page")
      }
    >
      <form
        className="note-create-form"
        onSubmit={async (event) => {
          event.preventDefault();
          const form = event.currentTarget;
          const data = new FormData(form);
          setPending(true);
          setError("");
          try {
            const result = await createWorkspacePageAction(data);
            if (result.id) {
              form.reset();
              setTemplate("blank");
              dialog.current?.close();
              router.push(`/notes/${result.id}`);
              router.refresh();
            } else
              setError(result.error || tr("Tente novamente.", "Try again."));
          } catch {
            setError(
              tr(
                "Não foi possível criar. Sua página pode já ter sido criada; confira a lista antes de tentar novamente.",
                "Could not finish. Your page may already exist; check the list before retrying.",
              ),
            );
          } finally {
            setPending(false);
          }
        }}
      >
        <label>
          {tr("Nome da página", "Page name")}
          <input
            name="title"
            autoFocus
            required
            maxLength={180}
            placeholder={tr("Ex.: Revisão de redes", "E.g. Network revision")}
          />
        </label>
        <fieldset className="note-template-picker">
          <legend>{tr("Começar com", "Start with")}</legend>
          {notePageTemplates.map((key) => (
            <label key={key} className={template === key ? "is-selected" : ""}>
              <input
                type="radio"
                name="template"
                value={key}
                checked={template === key}
                onChange={() => setTemplate(key)}
              />
              <strong>{labels[key][0]}</strong>
              <small>{labels[key][1]}</small>
            </label>
          ))}
        </fieldset>
        {parents.length ? (
          <label>
            {tr("Onde guardar", "Location")}
            <select name="parentNoteId" defaultValue={parentId ?? ""}>
              <option value="">{tr("Suas páginas", "Your pages")}</option>
              {parents.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <input type="hidden" name="parentNoteId" value={parentId ?? ""} />
        )}
        {offerings.length ? (
          <details open={!!offeringId}>
            <summary>
              {tr(
                "Associar a uma disciplina · opcional",
                "Link to a subject · optional",
              )}
            </summary>
            <label>
              {tr("Disciplina", "Subject")}
              <select name="offeringId" defaultValue={offeringId ?? ""}>
                <option value="">{tr("Sem disciplina", "No subject")}</option>
                {offerings.map((o) => (
                  <option key={o.offeringId} value={o.offeringId}>
                    {o.subjectName} · {o.periodLabel}
                  </option>
                ))}
              </select>
            </label>
          </details>
        ) : (
          <input type="hidden" name="offeringId" value={offeringId ?? ""} />
        )}
        <input type="hidden" name="activityId" value={activityId ?? ""} />
        <p className="note-muted">
          {subpage
            ? tr(
                "A subpágina começa privada. Você pode compartilhá-la depois.",
                "The subpage starts private. You can share it later.",
              )
            : tr(
                "Você pode adicionar blocos, imagens e bases depois de criar.",
                "You can add blocks, images and databases after creating.",
              )}
        </p>
        {error ? (
          <p className="form-error" role="alert">
            {error}
          </p>
        ) : null}
        <div className="note-dialog-actions">
          <button
            type="button"
            disabled={pending}
            onClick={() => dialog.current?.close()}
          >
            {tr("Cancelar", "Cancel")}
          </button>
          <button disabled={pending}>
            {pending
              ? tr("Criando…", "Creating…")
              : tr("Criar página →", "Create page →")}
          </button>
        </div>
      </form>
    </NotePanel>
  );
}
