import { UiCopy } from "@/components/ui-language-provider";
import Link from "next/link";

import { createNoteAction } from "@/app/notes/actions";
import { NoteLibraryCard } from "@/components/note-library-card";
import { PendingSubmitButton } from "@/components/pending-submit-button";
import { listUserSubjectOfferings } from "@/lib/academic";
import { listUserActivities } from "@/lib/activities";
import { requireAuthenticatedUser } from "@/lib/authorization";
import { listUserSharedNoteIds } from "@/lib/collaboration";
import { listSharedNotes, listUserNotes } from "@/lib/notes";
import { getUserProfile } from "@/lib/profile";
import { uiText } from "@/lib/translations";

export const dynamic = "force-dynamic";

type NotesPageProps = {
  searchParams: Promise<{
    q?: string;
    offeringId?: string;
    activityId?: string;
    layout?: string;
    status?: string;
  }>;
};

function selectedId(value: string | undefined): number | undefined {
  return value && /^\d+$/.test(value) ? Number(value) : undefined;
}

export default async function NotesPage({ searchParams }: NotesPageProps) {
  const user = await requireAuthenticatedUser();
  const language = getUserProfile(user.id).locale;
  const tr = (pt: string, en: string) => uiText(language, pt, en);
  const parameters = await searchParams;
  const query = parameters.q?.slice(0, 200) ?? "";
  const offerings = listUserSubjectOfferings(user.id);
  const activities = listUserActivities(user.id);
  const notes = listUserNotes(user.id, query);
  const sharedNotes = listSharedNotes(user.id);
  const sharedNoteIds = new Set(listUserSharedNoteIds(user.id));
  const defaultOfferingId = selectedId(parameters.offeringId);
  const defaultActivityId = selectedId(parameters.activityId);
  const layout = parameters.layout === "list" ? "list" : "grid";

  return (
    <div className="workflow-shell notes-shell resource-workspace">
      <header className="section-header resource-page-header">
        <div>
          <p className="eyebrow">
            <UiCopy pt="SEU ESPAÇO DE ESCRITA" en="YOUR WRITING SPACE" />
          </p>
          <h1>
            <UiCopy pt="Notas" en="Notes" />
          </h1>
          <p className="page-description">
            <UiCopy
              pt="Ideias, resumos e rascunhos. Cada nota começa privada."
              en="Ideas, summaries and drafts. Every note starts private."
            />
          </p>
        </div>
        <a className="primary-link" href="#nova-nota">
          <UiCopy pt="+ Nova nota" en="+ New note" />
        </a>
      </header>

      {parameters.status ? (
        <p
          className={`feedback-banner ${parameters.status === "error" ? "is-error" : "is-success"}`}
          role="status"
        >
          {parameters.status === "error"
            ? tr(
                "Não foi possível concluir a operação. Tente novamente.",
                "Could not complete the operation. Try again.",
              )
            : parameters.status === "deleted"
              ? tr("Nota excluída.", "Note deleted.")
              : parameters.status === "shared"
                ? tr("Compartilhamento atualizado.", "Sharing updated.")
                : tr("Nota salva.", "Note saved.")}
        </p>
      ) : null}

      <section
        className="note-create-studio"
        id="nova-nota"
        aria-labelledby="new-note-title"
      >
        <div className="note-create-intro">
          <span className="page-kicker">
            <UiCopy pt="COMEÇAR AGORA" en="GET STARTED" />
          </span>
          <h2 id="new-note-title">
            <UiCopy
              pt="Uma página para o que importa."
              en="A page for what matters."
            />
          </h2>
          <p>
            <UiCopy
              pt="Dê um nome à ideia. A disciplina e a atividade podem ser escolhidas agora ou depois, dentro do editor."
              en="Name your idea. You can choose a subject and activity now or later in the editor."
            />
          </p>
          <span className="note-private-hint">
            <UiCopy
              pt="◈ Privada até você compartilhar"
              en="◈ Private until you share"
            />
          </span>
        </div>
        <form className="note-create-form" action={createNoteAction}>
          <label>
            <UiCopy pt="Título da nota" en="Note title" />
            <input
              name="title"
              maxLength={180}
              placeholder={tr(
                "Sobre o que você vai escrever?",
                "What will you write about?",
              )}
              required
            />
          </label>
          <div className="note-create-context">
            <label>
              <UiCopy pt="Disciplina" en="Subject" />{" "}
              <small>
                <UiCopy pt="opcional" en="optional" />
              </small>
              <select name="offeringId" defaultValue={defaultOfferingId ?? ""}>
                <option value="">
                  <UiCopy pt="Sem disciplina" en="No subject" />
                </option>
                {offerings.map((offering) => (
                  <option key={offering.offeringId} value={offering.offeringId}>
                    {offering.subjectName} · {offering.periodLabel}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <UiCopy pt="Atividade" en="Activity" />{" "}
              <small>
                <UiCopy pt="opcional" en="optional" />
              </small>
              <select name="activityId" defaultValue={defaultActivityId ?? ""}>
                <option value="">
                  <UiCopy pt="Sem atividade" en="No activity" />
                </option>
                {activities.map((activity) => (
                  <option key={activity.id} value={activity.id}>
                    {activity.subjectName} · {activity.title}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <input type="hidden" name="content" value="" />
          <PendingSubmitButton
            pendingLabel={tr("Criando nota…", "Creating note…")}
          >
            <UiCopy pt="Criar e escrever →" en="Create and write →" />
          </PendingSubmitButton>
        </form>
      </section>

      <section
        className="resource-collection notes-library"
        aria-labelledby="notes-list-title"
      >
        <div className="resource-collection-header">
          <div>
            <span className="page-kicker">
              <UiCopy pt="BIBLIOTECA" en="LIBRARY" />
            </span>
            <h2 id="notes-list-title">
              <UiCopy pt="Suas notas" en="Your notes" />{" "}
              <small>{notes.length}</small>
            </h2>
          </div>
          <nav
            className="resource-view-toggle"
            aria-label={tr("Visualização das notas", "Notes view")}
          >
            <Link
              href={`/notes?layout=grid${query ? `&q=${encodeURIComponent(query)}` : ""}`}
              aria-current={layout === "grid" ? "page" : undefined}
            >
              <UiCopy pt="Grade" en="Grid" />
            </Link>
            <Link
              href={`/notes?layout=list${query ? `&q=${encodeURIComponent(query)}` : ""}`}
              aria-current={layout === "list" ? "page" : undefined}
            >
              <UiCopy pt="Lista" en="List" />
            </Link>
          </nav>
        </div>
        <form className="resource-search" action="/notes" method="get">
          <label htmlFor="note-query">
            <UiCopy pt="Buscar notas" en="Search notes" />
          </label>
          <input
            id="note-query"
            name="q"
            defaultValue={query}
            maxLength={200}
            placeholder={tr("Título ou conteúdo", "Title or content")}
          />
          <button type="submit">
            <UiCopy pt="Buscar" en="Search" />
          </button>
        </form>
        {notes.length === 0 ? (
          <div className="useful-empty resource-empty">
            <strong>
              {query
                ? tr("Nenhuma nota encontrada", "No notes found")
                : tr("Sua biblioteca começa aqui", "Your library starts here")}
            </strong>
            <p>
              {query
                ? "Tente outra palavra ou limpe a busca."
                : "Crie uma nota para guardar uma ideia, um resumo ou um rascunho."}
            </p>
            {query ? (
              <Link href="/notes">
                <UiCopy pt="Limpar busca" en="Clear search" />
              </Link>
            ) : (
              <a href="#nova-nota">
                <UiCopy pt="Criar primeira nota →" en="Create first note →" />
              </a>
            )}
          </div>
        ) : (
          <ol className={`note-card-grid is-${layout}`}>
            {notes.map((note) => (
              <NoteLibraryCard
                key={note.id}
                note={note}
                href={`/notes/${note.id}?from=notes`}
                shared={sharedNoteIds.has(note.id)}
                language={language}
              />
            ))}
          </ol>
        )}
      </section>

      <section
        className="resource-collection shared-notes-library"
        aria-labelledby="shared-notes-title"
      >
        <div className="resource-collection-header">
          <div>
            <span className="page-kicker">
              <UiCopy pt="EM GRUPO" en="SHARED" />
            </span>
            <h2 id="shared-notes-title">
              <UiCopy pt="Compartilhadas com você" en="Shared with you" />
              <small>{sharedNotes.length}</small>
            </h2>
          </div>
        </div>
        {sharedNotes.length === 0 ? (
          <div className="useful-empty resource-empty compact">
            <strong>
              <UiCopy
                pt="Sem notas compartilhadas por enquanto"
                en="No shared notes yet"
              />
            </strong>
            <p>
              <UiCopy
                pt="As notas dos seus grupos aparecerão aqui quando alguém compartilhar."
                en="Notes from your groups will appear here when someone shares them."
              />
            </p>
          </div>
        ) : (
          <ol className={`note-card-grid is-${layout}`}>
            {sharedNotes.map((note) => (
              <NoteLibraryCard
                key={note.id}
                note={note}
                href={`/notes/${note.id}?from=notes`}
                shared
                ownerName={note.ownerName}
                language={language}
              />
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}
