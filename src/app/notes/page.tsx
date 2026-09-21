import Link from "next/link";

import { createNoteAction } from "@/app/notes/actions";
import { listUserSubjectOfferings } from "@/lib/academic";
import { listUserActivities } from "@/lib/activities";
import { requireAuthenticatedUser } from "@/lib/authorization";
import { listSharedNotes, listUserNotes } from "@/lib/notes";

export const dynamic = "force-dynamic";

type NotesPageProps = {
  searchParams: Promise<{
    q?: string;
    offeringId?: string;
    activityId?: string;
    status?: string;
  }>;
};

function selectedId(value: string | undefined): number | undefined {
  return value && /^\d+$/.test(value) ? Number(value) : undefined;
}

export default async function NotesPage({ searchParams }: NotesPageProps) {
  const user = await requireAuthenticatedUser();
  const parameters = await searchParams;
  const query = parameters.q?.slice(0, 200) ?? "";
  const offerings = listUserSubjectOfferings(user.id);
  const activities = listUserActivities(user.id);
  const notes = listUserNotes(user.id, query);
  const sharedNotes = listSharedNotes(user.id);
  const defaultOfferingId = selectedId(parameters.offeringId);
  const defaultActivityId = selectedId(parameters.activityId);

  return (
    <div className="workflow-shell notes-shell">
      <header className="section-header">
        <div>
          <p className="eyebrow">BIBLIOTECA PESSOAL</p>
          <h1>NOTAS PRIVADAS</h1>
          <p className="page-description">
            Escrita pessoal, privada e portátil.
          </p>
        </div>
      </header>

      {parameters.status ? (
        <p
          className={`feedback-banner ${parameters.status === "error" ? "is-error" : "is-success"}`}
          role="status"
        >
          {parameters.status === "error"
            ? "Não foi possível concluir a operação."
            : "Nota atualizada."}
        </p>
      ) : null}

      <div className="notes-library-layout">
        <section className="utility-panel notes-library">
          <div className="panel-title">
            <span>SUAS NOTAS</span>
            <span>{notes.length.toString().padStart(2, "0")}</span>
          </div>
          <form className="inline-search" action="/notes" method="get">
            <label>
              Buscar por título ou conteúdo
              <input
                name="q"
                defaultValue={query}
                maxLength={200}
                placeholder="Digite para filtrar…"
              />
            </label>
            <button type="submit">Buscar</button>
          </form>
          {notes.length === 0 ? (
            <div className="useful-empty">
              <strong>
                {query
                  ? "Nenhuma nota encontrada"
                  : "Sua biblioteca está vazia"}
              </strong>
              <p>
                {query
                  ? "Tente outra palavra ou limpe a busca."
                  : "Crie uma nota livre ou comece a partir de uma matéria."}
              </p>
              {query ? <Link href="/notes">Limpar busca</Link> : null}
            </div>
          ) : (
            <ol className="note-list">
              {notes.map((note) => (
                <li key={note.id}>
                  <Link href={`/notes/${note.id}`}>
                    <strong>{note.title}</strong>
                    <span>
                      {[note.subjectName, note.activityTitle]
                        .filter(Boolean)
                        .join(" · ") || "Nota livre"}
                    </span>
                    <time dateTime={new Date(note.updatedAt).toISOString()}>
                      {new Intl.DateTimeFormat("pt-BR", {
                        dateStyle: "short",
                        timeStyle: "short",
                      }).format(note.updatedAt)}
                    </time>
                  </Link>
                </li>
              ))}
            </ol>
          )}
        </section>

        <section className="utility-panel shared-notes-library">
          <div className="panel-title">
            <span>COMPARTILHADAS COM VOCÊ</span>
            <span>{sharedNotes.length.toString().padStart(2, "0")}</span>
          </div>
          {sharedNotes.length === 0 ? (
            <div className="useful-empty compact">
              <strong>Nenhuma nota compartilhada</strong>
              <p>
                Notas de disciplina compartilhadas por seus grupos aparecerão
                aqui.
              </p>
            </div>
          ) : (
            <ol className="note-list">
              {sharedNotes.map((note) => (
                <li key={note.id}>
                  <Link href={`/notes/${note.id}`}>
                    <strong>{note.title}</strong>
                    <span>
                      {[note.subjectName, `por ${note.ownerName}`]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                    <time dateTime={new Date(note.updatedAt).toISOString()}>
                      {new Intl.DateTimeFormat("pt-BR", {
                        dateStyle: "short",
                        timeStyle: "short",
                      }).format(note.updatedAt)}
                    </time>
                  </Link>
                </li>
              ))}
            </ol>
          )}
        </section>

        <details
          className="utility-panel new-note-panel"
          open={notes.length === 0}
        >
          <summary id="nova-nota">CRIAR UMA NOTA</summary>
          <p className="panel-help">
            Dê um título agora. O conteúdo será escrito e salvo automaticamente
            na página seguinte.
          </p>
          <form className="workflow-form" action={createNoteAction}>
            <label className="wide-field">
              Título
              <input
                name="title"
                maxLength={180}
                placeholder="Ex.: Herança e polimorfismo"
                required
              />
            </label>
            <label>
              Matéria
              <select name="offeringId" defaultValue={defaultOfferingId ?? ""}>
                <option value="">Sem matéria</option>
                {offerings.map((offering) => (
                  <option key={offering.offeringId} value={offering.offeringId}>
                    {offering.subjectName} · {offering.periodLabel}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Atividade
              <select name="activityId" defaultValue={defaultActivityId ?? ""}>
                <option value="">Sem atividade</option>
                {activities.map((activity) => (
                  <option key={activity.id} value={activity.id}>
                    {activity.subjectName} · {activity.title}
                  </option>
                ))}
              </select>
            </label>
            <input type="hidden" name="content" value="" />
            <button className="wide-field" type="submit">
              Criar e começar a escrever
            </button>
          </form>
        </details>
      </div>
    </div>
  );
}
