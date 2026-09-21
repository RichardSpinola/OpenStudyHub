import Link from "next/link";
import { notFound } from "next/navigation";

import { deleteNoteAction, setNoteGroupShareAction } from "@/app/notes/actions";
import { NoteEditor } from "@/components/note-editor";
import { markdownToEditorHtml } from "@/lib/note-editor-format";
import { listUserSubjectOfferings } from "@/lib/academic";
import { listUserActivities } from "@/lib/activities";
import { requireAuthenticatedUser } from "@/lib/authorization";
import { getReadableNote } from "@/lib/notes";
import { listUserStudyGroups } from "@/lib/collaboration";

export const dynamic = "force-dynamic";

type NotePageProps = {
  params: Promise<{ noteId: string }>;
  searchParams: Promise<{ status?: string }>;
};

export default async function NotePage({
  params,
  searchParams,
}: NotePageProps) {
  const user = await requireAuthenticatedUser();
  const rawId = (await params).noteId;
  if (!/^\d+$/.test(rawId)) notFound();
  const noteId = Number(rawId);
  let note;
  try {
    note = getReadableNote(user.id, noteId);
  } catch {
    notFound();
  }
  const parameters = await searchParams;
  const offerings = listUserSubjectOfferings(user.id);
  const activities = listUserActivities(user.id);
  const offering = offerings.find(
    ({ offeringId }) => offeringId === note.offeringId,
  );
  const groups = listUserStudyGroups(user.id).filter(
    (group) =>
      group.subjectOfferingId === null ||
      group.subjectOfferingId === note.offeringId,
  );

  return (
    <div className="workflow-shell note-editor-shell">
      <header className="section-header note-editor-heading">
        <div>
          <p className="eyebrow">
            NOTAS / {offering?.subjectName ?? "NOTA LIVRE"}
          </p>
          <span className="page-kicker">Sua página pessoal</span>
        </div>
        <Link className="text-link" href="/notes">
          ← Todas as notas
        </Link>
      </header>
      {parameters.status === "error" ? (
        <p className="form-error" role="alert">
          A OPERAÇÃO FOI RECUSADA.
        </p>
      ) : null}
      <main className="note-canvas">
        {note.editable ? (
          <NoteEditor
            note={{
              id: note.id,
              title: note.title,
              content: note.content,
              offeringId: note.offeringId,
              activityId: note.activityId,
            }}
            offerings={offerings.map((item) => ({
              id: item.offeringId,
              label: `${item.subjectName} · ${item.periodLabel}`,
            }))}
            activities={activities.map((activity) => ({
              id: activity.id,
              offeringId: activity.offeringId,
              label: activity.title,
            }))}
          />
        ) : (
          <article className="shared-note-view">
            <h1>{note.title}</h1>
            <div
              className="shared-note-rendered"
              dangerouslySetInnerHTML={{
                __html: markdownToEditorHtml(note.content),
              }}
            />
            <p>
              Compartilhada com um grupo. Somente o proprietário pode editar.
            </p>
          </article>
        )}
        <footer className="note-editor-footer">
          <div className="panel-actions">
            <a
              className="text-link"
              href={`/notes/${note.id}/export?format=md`}
            >
              Exportar Markdown
            </a>
            <a
              className="text-link"
              href={`/notes/${note.id}/export?format=html`}
            >
              Exportar HTML
            </a>
            {note.editable && note.offeringId && groups.length ? (
              <details>
                <summary>Compartilhar com grupo</summary>
                <form action={setNoteGroupShareAction}>
                  <input type="hidden" name="noteId" value={note.id} />
                  <input type="hidden" name="shared" value="true" />
                  <select name="groupId" required>
                    {groups.map((group) => (
                      <option key={group.id} value={group.id}>
                        {group.name}
                      </option>
                    ))}
                  </select>
                  <button type="submit">Compartilhar</button>
                </form>
              </details>
            ) : null}
            {note.editable ? (
              <form action={deleteNoteAction}>
                <input type="hidden" name="noteId" value={note.id} />
                <button className="danger-button" type="submit">
                  Excluir nota
                </button>
              </form>
            ) : null}
          </div>
        </footer>
      </main>
    </div>
  );
}
