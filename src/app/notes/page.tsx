import Link from "next/link";
import { UiCopy } from "@/components/ui-language-provider";
import { NoteNavigation } from "@/components/note-navigation";
import { NoteLibraryCard } from "@/components/note-library-card";
import { PendingSubmitButton } from "@/components/pending-submit-button";
import { NoteImport } from "@/components/note-import";
import { createNoteAction } from "@/app/notes/actions";
import { requireToolUser } from "@/lib/authorization";
import { listUserNotes, listSharedNotes } from "@/lib/notes";
import { listUserSubjectOfferings } from "@/lib/academic";
import { listUserSharedNoteIds } from "@/lib/collaboration";
import { getUserProfile } from "@/lib/profile";
import { uiText } from "@/lib/translations";
export const dynamic = "force-dynamic";
export default async function NotesPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    offeringId?: string;
    activityId?: string;
    layout?: string;
    status?: string;
  }>;
}) {
  const user = await requireToolUser(),
    language = getUserProfile(user.id).locale,
    tr = (pt: string, en: string) => uiText(language, pt, en),
    parameters = await searchParams;
  const q = parameters.q?.slice(0, 200) ?? "",
    all = listUserNotes(user.id),
    shared = listSharedNotes(user.id),
    matches = listUserNotes(user.id, q),
    ids = new Set(listUserSharedNoteIds(user.id)),
    offerings = listUserSubjectOfferings(user.id);
  const layout = parameters.layout === "list" ? "list" : "grid";
  const sharedMatches = shared.filter(
    (n) =>
      !q ||
      `${n.title} ${n.content}`
        .toLocaleLowerCase()
        .includes(q.toLocaleLowerCase()),
  );
  return (
    <div className="notes-workspace-shell notes-workspace-index">
      <NoteNavigation notes={all.map(({id,title,parentNoteId})=>({id,title,parentNoteId}))} shared={shared.map(({id,title,parentNoteId})=>({id,title,parentNoteId}))} />
      <main className="notes-workspace-main">
        <header className="note-collection-heading">
          <div>
            <p className="eyebrow">
              {tr("SEU ESPAÇO DE ESCRITA", "YOUR WRITING SPACE")}
            </p>
            <h1>{tr("Notas", "Notes")}</h1>
            <p className="note-muted">
              {tr(
                "Páginas, ideias e trabalhos em grupo. Tudo começa privado.",
                "Pages, ideas and group work. Everything starts private.",
              )}
            </p>
          </div>
          <NoteImport />
        </header>
        {parameters.status ? (
          <p
            role="status"
            className={
              parameters.status === "error"
                ? "form-error"
                : "feedback-banner is-success"
            }
          >
            {parameters.status === "error"
              ? tr(
                  "Não foi possível criar a página. Confira o título, o arquivo e a disciplina.",
                  "Could not create the page. Check its title, file and subject.",
                )
              : tr(
                  "Página excluída. As subpáginas foram mantidas.",
                  "Page deleted. Subpages were kept.",
                )}
          </p>
        ) : null}
        <section
          className="note-quick-create"
          id="nova-nota"
          aria-label={tr("Criar página", "Create page")}
        >
          <form action={createNoteAction}>
            <label>
              {tr("Nova página", "New page")}
              <input
                name="title"
                placeholder={tr("Dê um nome à sua ideia…", "Name your idea…")}
                required
                maxLength={180}
              />
            </label>
            <label>
              {tr("Disciplina · opcional", "Subject · optional")}
              <select
                name="offeringId"
                defaultValue={parameters.offeringId ?? ""}
              >
                <option value="">{tr("Sem disciplina", "No subject")}</option>
                {offerings.map((o) => (
                  <option key={o.offeringId} value={o.offeringId}>
                    {o.subjectName} · {o.periodLabel}
                  </option>
                ))}
              </select>
            </label>
            <input
              name="activityId"
              type="hidden"
              value={parameters.activityId ?? ""}
            />
            <input name="content" type="hidden" value="" />
            <PendingSubmitButton pendingLabel={tr("Criando…", "Creating…")}>
              {tr("Criar e escrever →", "Create and write →")}
            </PendingSubmitButton>
          </form>
        </section>
        <section className="resource-collection notes-library">
          <header className="resource-collection-header">
            <h2>
              {q
                ? tr(`Resultados para “${q}”`, `Results for “${q}”`)
                : tr("Suas páginas", "Your pages")}{" "}
              <small>{matches.length}</small>
            </h2>
            <nav
              className="resource-view-toggle"
              aria-label={tr("Visualização", "View")}
            >
              <Link
                href={`/notes?layout=grid&q=${encodeURIComponent(q)}`}
                aria-current={layout === "grid" ? "page" : undefined}
              >
                {tr("Grade", "Grid")}
              </Link>
              <Link
                href={`/notes?layout=list&q=${encodeURIComponent(q)}`}
                aria-current={layout === "list" ? "page" : undefined}
              >
                {tr("Lista", "List")}
              </Link>
            </nav>
          </header>
          {matches.length ? (
            <ol className={`note-card-grid is-${layout}`}>
              {matches.map((n) => (
                <NoteLibraryCard
                  key={n.id}
                  note={n}
                  href={`/notes/${n.id}`}
                  shared={ids.has(n.id)}
                  language={language}
                />
              ))}
            </ol>
          ) : (
            <div className="useful-empty">
              <strong>
                {q
                  ? tr("Nenhuma página encontrada", "No pages found")
                  : tr("Uma página para começar", "A page to start")}
              </strong>
              <p>
                {q
                  ? tr(
                      "Tente outra palavra ou limpe a busca.",
                      "Try another word or clear the search.",
                    )
                  : tr(
                      "Escreva normalmente, use / para adicionar blocos e organize o conteúdo em subpáginas.",
                      "Write normally, use / to add blocks, and organize your content in subpages.",
                    )}
              </p>
              {q ? (
                <Link href="/notes">{tr("Limpar busca", "Clear search")}</Link>
              ) : (
                <a href="#nova-nota">
                  {tr("Criar primeira página →", "Create first page →")}
                </a>
              )}
            </div>
          )}
        </section>
        <section className="resource-collection shared-notes-library">
          <h2>
            <UiCopy pt="Compartilhadas comigo" en="Shared with me" />{" "}
            <small>{sharedMatches.length}</small>
          </h2>
          {sharedMatches.length ? (
            <ol className={`note-card-grid is-${layout}`}>
              {sharedMatches.map((n) => (
                <NoteLibraryCard
                  key={n.id}
                  note={n}
                  href={`/notes/${n.id}`}
                  shared
                  ownerName={n.ownerName}
                  language={language}
                />
              ))}
            </ol>
          ) : (
            <p className="note-muted">
              {tr(
                "As páginas compartilhadas com você ou seus grupos aparecerão aqui.",
                "Pages shared with you or your groups will appear here.",
              )}
            </p>
          )}
        </section>
      </main>
    </div>
  );
}
