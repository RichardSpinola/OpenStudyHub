import { UiCopy } from "@/components/ui-language-provider";
import Link from "next/link";
import { notFound } from "next/navigation";

import {
  deleteNoteAction,
  setNoteGroupShareAction,
  setNotePersonShareAction,
} from "@/app/notes/actions";
import { NoteEditor } from "@/components/note-editor";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
import { markdownToEditorHtml } from "@/lib/note-editor-format";
import { listUserSubjectOfferings } from "@/lib/academic";
import { listUserActivities } from "@/lib/activities";
import { requireAuthenticatedUser } from "@/lib/authorization";
import { getReadableNote } from "@/lib/notes";
import { getUserProfile } from "@/lib/profile";
import { uiText } from "@/lib/translations";
import {
  listNoteGroupShares,
  listNotePersonShares,
  listUserStudyGroups,
  listVisibleUsers,
} from "@/lib/collaboration";

export const dynamic = "force-dynamic";

type NotePageProps = {
  params: Promise<{ noteId: string }>;
  searchParams: Promise<{ status?: string; from?: string }>;
};

export default async function NotePage({
  params,
  searchParams,
}: NotePageProps) {
  const user = await requireAuthenticatedUser();
  const language = getUserProfile(user.id).locale;
  const tr = (pt: string, en: string) => uiText(language, pt, en);
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
  const noteShares = note.editable ? listNoteGroupShares(user.id, note.id) : [];
  const noteShareGroupIds = new Set(noteShares.map(({ groupId }) => groupId));
  const personShares = note.editable
    ? listNotePersonShares(user.id, note.id)
    : [];
  const shareUsers = note.editable
    ? listVisibleUsers(user.id).filter(
        ({ id }) => !personShares.some((person) => person.userId === id),
      )
    : [];

  return (
    <div className="workflow-shell note-editor-shell">
      <header className="section-header note-editor-heading">
        <div>
          <p className="eyebrow">
            <UiCopy pt="NOTAS /" en="NOTES /" />{" "}
            {offering?.subjectName ?? tr("NOTA LIVRE", "FREE NOTE")}
          </p>
          <h1>{note.editable ? tr("Editar nota", "Edit note") : tr("Nota compartilhada", "Shared note")}</h1>
          <p className="page-description">
            {note.editable
              ? tr("Escreva com calma. Alterações são salvas automaticamente.", "Take your time. Changes are saved automatically.")
              : tr("Disponível para leitura porque foi compartilhada com você.", "Available to read because it was shared with you.")}
          </p>
        </div>
        <div className="note-heading-actions">
          {note.editable ? (
            <a className="primary-link" href="#note-sharing">
              <UiCopy pt="Compartilhar" en="Share" />
            </a>
          ) : null}
          <Link
            className="text-link"
            href={
              parameters.from === "notes"
                ? "/notes"
                : offering
                  ? `/subjects/${offering.subjectId}?view=notes`
                  : "/notes"
            }
          >
            {parameters.from === "notes"
              ? "← Todas as notas"
              : offering
                ? `← ${offering.subjectName}`
                : "← Todas as notas"}
          </Link>
        </div>
      </header>
      {parameters.status === "error" ? (
        <p className="form-error" role="alert">
          <UiCopy
            pt="A OPERAÇÃO FOI RECUSADA."
            en="THE OPERATION WAS REFUSED."
          />
        </p>
      ) : null}
      {parameters.status === "ok" ? (
        <p className="feedback-banner is-success" role="status">
          <UiCopy pt="Compartilhamento atualizado." en="Sharing updated." />
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
              <UiCopy
                pt="Compartilhada com um grupo. Somente o proprietário pode editar."
                en="Shared with a group. Only the owner can edit."
              />
            </p>
          </article>
        )}
        <footer className="note-editor-footer">
          <div className="panel-actions">
            <a
              className="text-link"
              href={`/notes/${note.id}/export?format=md`}
            >
              <UiCopy pt="Exportar Markdown" en="Export Markdown" />
            </a>
            <a
              className="text-link"
              href={`/notes/${note.id}/export?format=html`}
            >
              <UiCopy pt="Exportar HTML" en="Export HTML" />
            </a>
            {note.editable ? (
              <section
                id="note-sharing"
                className="note-sharing-panel"
                aria-label="Compartilhamento da nota"
              >
                <h2>
                  <UiCopy pt="Compartilhar nota" en="Share note" />
                </h2>
                <p>
                  <UiCopy
                    pt="Privada por padrão. Só as pessoas e os grupos escolhidos podem ler; você continua sendo o único editor."
                    en="Private by default. Only chosen people and groups can read it; you remain the only editor."
                  />
                </p>
                {personShares.length || noteShares.length ? (
                  <ul>
                    {personShares.map((person) => (
                      <li key={`person-${person.userId}`}>
                        <UiCopy pt="Pessoa:" en="Person:" />{" "}
                        {person.displayName}
                        <form action={setNotePersonShareAction}>
                          <input type="hidden" name="noteId" value={note.id} />
                          <input
                            type="hidden"
                            name="recipientUserId"
                            value={person.userId}
                          />
                          <input type="hidden" name="shared" value="false" />
                          <ConfirmSubmitButton
                            confirmation={tr(`Remover o acesso de ${person.displayName}?`, `Remove access for ${person.displayName}?`)}
                          >
                            <UiCopy pt="Remover acesso" en="Remove access" />
                          </ConfirmSubmitButton>
                        </form>
                      </li>
                    ))}
                    {noteShares.map((group) => (
                      <li key={`group-${group.groupId}`}>
                        <UiCopy pt="Grupo:" en="Group:" /> {group.groupName}
                        <form action={setNoteGroupShareAction}>
                          <input type="hidden" name="noteId" value={note.id} />
                          <input
                            type="hidden"
                            name="groupId"
                            value={group.groupId}
                          />
                          <input type="hidden" name="shared" value="false" />
                          <ConfirmSubmitButton
                            confirmation={tr(`Remover o acesso do grupo ${group.groupName}?`, `Remove access for group ${group.groupName}?`)}
                          >
                            <UiCopy pt="Remover acesso" en="Remove access" />
                          </ConfirmSubmitButton>
                        </form>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p>
                    <UiCopy
                      pt="Ninguém mais tem acesso a esta nota."
                      en="No one else has access to this note."
                    />
                  </p>
                )}
                {shareUsers.length ? (
                  <form action={setNotePersonShareAction}>
                    <input type="hidden" name="noteId" value={note.id} />
                    <input type="hidden" name="shared" value="true" />
                    <label>
                      <UiCopy
                        pt="Compartilhar com pessoa"
                        en="Share with person"
                      />{" "}
                      <select name="recipientUserId" required defaultValue="">
                        <option value="">
                          <UiCopy
                            pt="Selecione uma pessoa"
                            en="Select a person"
                          />
                        </option>
                        {shareUsers.map((person) => (
                          <option key={person.id} value={person.id}>
                            {person.displayName}
                          </option>
                        ))}
                      </select>
                    </label>
                    <button type="submit">
                      <UiCopy
                        pt="Compartilhar com pessoa"
                        en="Share with a person"
                      />
                    </button>
                  </form>
                ) : null}
                {note.offeringId &&
                groups.some((group) => !noteShareGroupIds.has(group.id)) ? (
                  <form action={setNoteGroupShareAction}>
                    <input type="hidden" name="noteId" value={note.id} />
                    <input type="hidden" name="shared" value="true" />
                    <label>
                      <UiCopy
                        pt="Compartilhar com grupo"
                        en="Share with group"
                      />{" "}
                      <select name="groupId" required defaultValue="">
                        <option value="">
                          <UiCopy pt="Selecione um grupo" en="Select a group" />
                        </option>
                        {groups
                          .filter((group) => !noteShareGroupIds.has(group.id))
                          .map((group) => (
                            <option key={group.id} value={group.id}>
                              {group.name}
                            </option>
                          ))}
                      </select>
                    </label>
                    <button type="submit">
                      <UiCopy
                        pt="Compartilhar com grupo"
                        en="Share with a group"
                      />
                    </button>
                  </form>
                ) : null}
              </section>
            ) : null}
            {note.editable ? (
              <form action={deleteNoteAction}>
                <input type="hidden" name="noteId" value={note.id} />
                <ConfirmSubmitButton
                  className="danger-button"
                  type="submit"
                  confirmation={tr("Excluir esta nota? Esta ação não pode ser desfeita.", "Delete this note? This cannot be undone.")}
                >
                  <UiCopy pt="Excluir nota" en="Delete note" />
                </ConfirmSubmitButton>
              </form>
            ) : null}
          </div>
        </footer>
      </main>
    </div>
  );
}
