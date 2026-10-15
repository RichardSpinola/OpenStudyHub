import Link from "next/link";
import { notFound } from "next/navigation";
import { UiCopy } from "@/components/ui-language-provider";
import { NoteEditor } from "@/components/note-editor";
import { NoteNavigation } from "@/components/note-navigation";
import { NoteLiveTitle } from "@/components/note-live-title";
import { NotePanel } from "@/components/note-panel";
import { PendingSubmitButton } from "@/components/pending-submit-button";
import { requireToolUser } from "@/lib/authorization";
import { getReadableNote, listUserNotes, listSharedNotes } from "@/lib/notes";
import {
  initializeNoteWorkspace,
  listNoteVersions,
} from "@/lib/note-workspace";
import { listUserSubjectOfferings } from "@/lib/academic";
import { listUserActivities } from "@/lib/activities";
import { getUserProfile } from "@/lib/profile";
import { uiText } from "@/lib/translations";
import {
  listNoteGroupShares,
  listNotePersonShares,
  listUserStudyGroups,
  listVisibleUsers,
} from "@/lib/collaboration";
import {
  createNoteAction,
  deleteNoteAction,
  setNoteGroupShareAction,
  setNotePersonShareAction,
  moveNoteAction,
  updateNoteContextAction,
  copyNoteAction,
} from "@/app/notes/actions";

// The page stays server-rendered; only the editor loads in the browser.
export const dynamic = "force-dynamic";
export default async function NotePage({
  params,
  searchParams,
}: {
  params: Promise<{ noteId: string }>;
  searchParams: Promise<{ status?: string }>;
}) {
  const user = await requireToolUser();
  const language = getUserProfile(user.id).locale;
  const tr = (pt: string, en: string) => uiText(language, pt, en);
  const raw = (await params).noteId;
  if (!/^\d+$/.test(raw)) notFound();
  const id = Number(raw);
  let note;
  try {
    note = getReadableNote(user.id, id);
  } catch {
    notFound();
  }
  const owner = note.ownerUserId === user.id;
  const workspace = await initializeNoteWorkspace(user.id, id);
  const notes = listUserNotes(user.id),
    shared = listSharedNotes(user.id),
    parameters = await searchParams;
  const parent = note.parentNoteId
    ? [...notes, ...shared].find((n) => n.id === note.parentNoteId)
    : undefined;
  const offerings = owner ? listUserSubjectOfferings(user.id) : [],
    activities = owner ? listUserActivities(user.id) : [];
  const persons = owner ? listNotePersonShares(user.id, id) : [],
    groupShares = owner ? listNoteGroupShares(user.id, id) : [];
  const users = owner ? listVisibleUsers(user.id) : [],
    groups = owner ? listUserStudyGroups(user.id) : [];
  const versions = owner ? listNoteVersions(user.id, id) : [];
  return (
    <div className="notes-workspace-shell">
      <NoteNavigation
        notes={notes.map(({ id, title, parentNoteId }) => ({
          id,
          title,
          parentNoteId,
        }))}
        shared={shared.map(({ id, title, parentNoteId }) => ({
          id,
          title,
          parentNoteId,
        }))}
        activeId={id}
      />
      <main className="notes-workspace-main">
        <header className="note-page-bar">
          <nav aria-label={tr("Local da página", "Page location")}>
            <Link href="/notes">
              <UiCopy pt="Notas" en="Notes" />
            </Link>
            {parent ? (
              <>
                <span>/</span>
                <Link href={`/notes/${parent.id}`}>{parent.title}</Link>
              </>
            ) : null}
            <span>/</span>
            <NoteLiveTitle id={id} title={note.title} />
          </nav>
          <div className="note-page-bar-actions">
            {owner ? (
              <NotePanel label={tr("Compartilhar", "Share")}>
                <p>
                  {tr(
                    "Escolha quem pode ler ou editar esta página. Subpáginas mantêm suas próprias permissões.",
                    "Choose who can read or edit this page. Subpages keep their own permissions.",
                  )}
                </p>
                <h3>{tr("Pessoas com acesso", "People with access")}</h3>
                {!persons.length && !groupShares.length ? (
                  <p className="note-muted">
                    {tr("Só você tem acesso.", "Only you have access.")}
                  </p>
                ) : null}
                <ul className="note-access-list">
                  {persons.map((person) => (
                    <li key={`p-${person.userId}`}>
                      <strong>{person.displayName}</strong>
                      <form action={setNotePersonShareAction}>
                        <input name="noteId" type="hidden" value={id} />
                        <input
                          name="recipientUserId"
                          type="hidden"
                          value={person.userId}
                        />
                        <input name="shared" type="hidden" value="true" />
                        <select
                          name="permission"
                          defaultValue={person.canEdit ? "edit" : "read"}
                          aria-label={`${tr("Permissão de", "Permission for")} ${person.displayName}`}
                        >
                          <option value="read">
                            {tr("Pode ler", "Can read")}
                          </option>
                          <option value="edit">
                            {tr("Pode editar", "Can edit")}
                          </option>
                        </select>
                        <button>{tr("Atualizar", "Update")}</button>
                      </form>
                      <form action={setNotePersonShareAction}>
                        <input type="hidden" name="noteId" value={id} />
                        <input
                          type="hidden"
                          name="recipientUserId"
                          value={person.userId}
                        />
                        <input type="hidden" name="shared" value="false" />
                        <button>{tr("Remover acesso", "Remove access")}</button>
                      </form>
                    </li>
                  ))}
                  {groupShares.map((group) => (
                    <li key={`g-${group.groupId}`}>
                      <strong>♧ {group.groupName}</strong>
                      <form action={setNoteGroupShareAction}>
                        <input name="noteId" type="hidden" value={id} />
                        <input
                          name="groupId"
                          type="hidden"
                          value={group.groupId}
                        />
                        <input name="shared" type="hidden" value="true" />
                        <select
                          name="permission"
                          defaultValue={group.canEdit ? "edit" : "read"}
                          aria-label={`${tr("Permissão de", "Permission for")} ${group.groupName}`}
                        >
                          <option value="read">
                            {tr("Pode ler", "Can read")}
                          </option>
                          <option value="edit">
                            {tr("Pode editar", "Can edit")}
                          </option>
                        </select>
                        <button>{tr("Atualizar", "Update")}</button>
                      </form>
                      <form action={setNoteGroupShareAction}>
                        <input type="hidden" name="noteId" value={id} />
                        <input
                          type="hidden"
                          name="groupId"
                          value={group.groupId}
                        />
                        <input type="hidden" name="shared" value="false" />
                        <button>{tr("Remover acesso", "Remove access")}</button>
                      </form>
                    </li>
                  ))}
                </ul>
                <form
                  className="note-share-form"
                  action={setNotePersonShareAction}
                >
                  <input type="hidden" name="noteId" value={id} />
                  <input type="hidden" name="shared" value="true" />
                  <label>
                    {tr("Adicionar pessoa", "Add person")}
                    <select required name="recipientUserId" defaultValue="">
                      <option value="">
                        {tr("Escolha uma pessoa", "Choose a person")}
                      </option>
                      {users
                        .filter((u) => !persons.some((p) => p.userId === u.id))
                        .map((u) => (
                          <option key={u.id} value={u.id}>
                            {u.displayName}
                          </option>
                        ))}
                    </select>
                  </label>
                  <label>
                    {tr("Permissão", "Permission")}
                    <select name="permission">
                      <option value="read">{tr("Pode ler", "Can read")}</option>
                      <option value="edit">
                        {tr("Pode editar", "Can edit")}
                      </option>
                    </select>
                  </label>
                  <PendingSubmitButton pendingLabel="…">
                    {tr("Compartilhar", "Share")}
                  </PendingSubmitButton>
                </form>
                {groups.some(
                  (g) => !groupShares.some((s) => s.groupId === g.id),
                ) ? (
                  <form
                    className="note-share-form"
                    action={setNoteGroupShareAction}
                  >
                    <input type="hidden" name="noteId" value={id} />
                    <input type="hidden" name="shared" value="true" />
                    <label>
                      {tr("Adicionar grupo", "Add group")}
                      <select required name="groupId" defaultValue="">
                        <option value="">
                          {tr("Escolha um grupo", "Choose a group")}
                        </option>
                        {groups
                          .filter(
                            (g) => !groupShares.some((s) => s.groupId === g.id),
                          )
                          .map((g) => (
                            <option key={g.id} value={g.id}>
                              {g.name}
                            </option>
                          ))}
                      </select>
                    </label>
                    <label>
                      {tr("Permissão", "Permission")}
                      <select name="permission">
                        <option value="read">
                          {tr("Pode ler", "Can read")}
                        </option>
                        <option value="edit">
                          {tr("Pode editar", "Can edit")}
                        </option>
                      </select>
                    </label>
                    <PendingSubmitButton pendingLabel="…">
                      {tr("Compartilhar", "Share")}
                    </PendingSubmitButton>
                  </form>
                ) : null}
                <Link href="/chat">
                  {tr("Gerenciar meus grupos →", "Manage my groups →")}
                </Link>
              </NotePanel>
            ) : null}
            <NotePanel label={tr("Opções da página", "Page options")}>
              <h3>{tr("Exportar", "Export")}</h3>
              <div className="note-options-links">
                <a download href={`/notes/${id}/export?format=md`}>
                  Markdown ↓
                </a>
                <a download href={`/notes/${id}/export?format=html`}>
                  HTML ↓
                </a>
              </div>
              {owner ? (
                <>
                  <h3>{tr("Organizar", "Organize")}</h3>
                  <form className="note-settings-form" action={moveNoteAction}>
                    <input name="noteId" type="hidden" value={id} />
                    <label>
                      {tr("Página principal", "Parent page")}
                      <select
                        name="parentNoteId"
                        defaultValue={note.parentNoteId ?? ""}
                      >
                        <option value="">
                          {tr("Sem página principal", "No parent page")}
                        </option>
                        {notes
                          .filter((n) => n.id !== id)
                          .map((n) => (
                            <option key={n.id} value={n.id}>
                              {n.title}
                            </option>
                          ))}
                      </select>
                    </label>
                    <button>{tr("Mover página", "Move page")}</button>
                  </form>
                  <form
                    className="note-settings-form"
                    action={updateNoteContextAction}
                  >
                    <input type="hidden" name="noteId" value={id} />
                    <label>
                      {tr("Disciplina · opcional", "Subject · optional")}
                      <select
                        name="offeringId"
                        defaultValue={note.offeringId ?? ""}
                      >
                        <option value="">
                          {tr("Sem disciplina", "No subject")}
                        </option>
                        {offerings.map((o) => (
                          <option key={o.offeringId} value={o.offeringId}>
                            {o.subjectName} · {o.periodLabel}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      {tr("Atividade · opcional", "Activity · optional")}
                      <select
                        name="activityId"
                        defaultValue={note.activityId ?? ""}
                      >
                        <option value="">
                          {tr("Sem atividade", "No activity")}
                        </option>
                        {activities.map((a) => (
                          <option key={a.id} value={a.id}>
                            {a.subjectName} · {a.title}
                          </option>
                        ))}
                      </select>
                    </label>
                    <button>
                      {tr("Salvar associação", "Save association")}
                    </button>
                  </form>
                  <form action={copyNoteAction}>
                    <input type="hidden" name="noteId" value={id} />
                    <button>{tr("Duplicar página", "Duplicate page")}</button>
                  </form>
                  <details>
                    <summary>
                      {tr("Histórico e recuperação", "History and recovery")}
                    </summary>
                    <p className="note-muted">
                      {tr(
                        "Até 15 versões recentes. Recuperar cria uma cópia privada e mantém esta página intacta.",
                        "Up to 15 recent versions. Recovery creates a private copy and keeps this page intact.",
                      )}
                    </p>
                    {versions.length ? (
                      <ul className="note-version-list">
                        {versions.map((v) => (
                          <li key={v.revision}>
                            <span>
                              {new Intl.DateTimeFormat(language, {
                                dateStyle: "short",
                                timeStyle: "short",
                              }).format(v.createdAt)}{" "}
                              · {v.author}
                            </span>
                            <form action={copyNoteAction}>
                              <input type="hidden" name="noteId" value={id} />
                              <input
                                type="hidden"
                                name="revision"
                                value={v.revision}
                              />
                              <button>
                                {tr("Recuperar como cópia", "Recover as copy")}
                              </button>
                            </form>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p>
                        {tr(
                          "As versões aparecerão depois das primeiras alterações.",
                          "Versions will appear after your first changes.",
                        )}
                      </p>
                    )}
                  </details>
                  <details className="note-danger-zone">
                    <summary>
                      {tr("Excluir esta página", "Delete this page")}
                    </summary>
                    <p>
                      {tr(
                        "A exclusão é permanente. As subpáginas serão mantidas como páginas independentes. Baixe uma cópia antes, se precisar.",
                        "Deletion is permanent. Subpages will remain as independent pages. Download a copy first if needed.",
                      )}
                    </p>
                    <form action={deleteNoteAction}>
                      <input name="noteId" type="hidden" value={id} />
                      <label>
                        {tr(
                          "Digite EXCLUIR para confirmar",
                          "Type DELETE to confirm",
                        )}
                        <input
                          name="confirmation"
                          required
                          pattern={language === "en" ? "DELETE" : "EXCLUIR"}
                        />
                      </label>
                      <button className="danger-button">
                        {tr("Excluir permanentemente", "Delete permanently")}
                      </button>
                    </form>
                  </details>
                </>
              ) : null}
            </NotePanel>
          </div>
        </header>
        {parameters.status ? (
          <p
            role="status"
            className={
              parameters.status.includes("error")
                ? "form-error"
                : "feedback-banner is-success"
            }
          >
            {parameters.status === "context-error"
              ? tr(
                  "A disciplina e a atividade precisam corresponder. Abra Opções da página e escolha novamente.",
                  "Subject and activity must match. Open Page options and choose again.",
                )
              : parameters.status.includes("error")
                ? tr(
                    "Não foi possível concluir. Confira as informações e tente novamente.",
                    "Could not complete this. Check the information and retry.",
                  )
                : tr("Alteração salva.", "Change saved.")}
          </p>
        ) : null}
        <NoteEditor
          note={{ id, title: note.title }}
          userId={user.id}
          userName={user.displayName}
          workspace={workspace}
        />
        <section className="note-child-pages">
          <h2>{tr("Subpáginas", "Subpages")}</h2>
          {[...notes, ...shared]
            .filter((n) => n.parentNoteId === id)
            .map((n) => (
              <Link href={`/notes/${n.id}`} key={n.id}>
                ▤ {n.title} →
              </Link>
            ))}
          {owner ? (
            <form action={createNoteAction}>
              <input
                name="title"
                type="hidden"
                value={tr("Sem título", "Untitled")}
              />
              <input type="hidden" name="content" value="" />
              <input type="hidden" name="parentNoteId" value={id} />
              <input
                type="hidden"
                name="offeringId"
                value={note.offeringId ?? ""}
              />
              <PendingSubmitButton pendingLabel="…">
                + {tr("Nova subpágina", "New subpage")}
              </PendingSubmitButton>
            </form>
          ) : (
            <p className="note-muted">
              {tr(
                "Cada subpágina é compartilhada separadamente.",
                "Each subpage is shared separately.",
              )}
            </p>
          )}
        </section>
      </main>
    </div>
  );
}
