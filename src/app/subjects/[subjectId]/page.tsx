import Link from "next/link";
import { notFound } from "next/navigation";

import { createProjectAction } from "@/app/projects/actions";
import { syncClassroomActivitiesAction } from "@/app/subjects/[subjectId]/actions";
import { SubjectAutoSync } from "@/components/subject-auto-sync";
import {
  getSubject,
  listUserAgenda,
  listUserSubjectOfferings,
} from "@/lib/academic";
import {
  formatAcademicDateTime,
  formatMinutes,
  joinLocation,
} from "@/lib/academic-format";
import { listUserActivities } from "@/lib/activities";
import { requireAuthenticatedUser } from "@/lib/authorization";
import { listUserGeneratedDocuments } from "@/lib/document-workflows";
import {
  getClassroomSyncState,
  listClassroomFeedItems,
} from "@/lib/google/classroom";
import { getGoogleConnection } from "@/lib/google/connections";
import { listOfferingGoogleIntegrations } from "@/lib/google/offering-integrations";
import { listUserNotes } from "@/lib/notes";
import {
  projectLanguageLabels,
  projectLanguages,
  projectTechnologies,
  projectTechnologyLabels,
} from "@/lib/project-manifest";
import { listUserProjects } from "@/lib/projects";
import { isProjectsFeatureEnabled } from "@/lib/feature-flags";
import {
  findNextSubjectFeedItem,
  listUserSubjectFeed,
} from "@/lib/subject-feed";
import { getTranslations } from "@/lib/translations";
import {
  defaultUiLanguage,
  getUiLanguage,
  type UiLanguage,
} from "@/lib/ui-language";

export const dynamic = "force-dynamic";

const baseViews = [
  ["overview", "Visão geral"],
  ["wall", "Mural"],
  ["activities", "Atividades"],
  ["notes", "Notas"],
  ["documents", "Documentos"],
  ["projects", "Projetos"],
] as const;
type SubjectView = (typeof baseViews)[number][0];

function activityGroups(
  activities: ReturnType<typeof listUserActivities>,
  now = Date.now(),
) {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const startTime = start.getTime();
  const day = 24 * 60 * 60 * 1000;
  const active = activities.filter(
    ({ status }) => !["completed", "submitted", "archived"].includes(status),
  );
  return {
    week: active.filter(
      ({ dueAt }) =>
        dueAt !== null && dueAt >= startTime && dueAt <= startTime + 7 * day,
    ),
    next: active.filter(
      ({ dueAt }) =>
        dueAt !== null &&
        dueAt > startTime + 7 * day &&
        dueAt <= startTime + 14 * day,
    ),
    noDeadline: active.filter(({ dueAt }) => dueAt === null),
    later: active.filter(
      ({ dueAt }) => dueAt !== null && dueAt > startTime + 14 * day,
    ),
    history: activities.filter(
      ({ dueAt, status }) =>
        ["completed", "submitted"].includes(status) ||
        (dueAt !== null && dueAt < startTime),
    ),
  };
}

export default async function SubjectPage({
  params,
  searchParams,
}: {
  params: Promise<{ subjectId: string }>;
  searchParams: Promise<{ google?: string; view?: string; status?: string }>;
}) {
  const user = await requireAuthenticatedUser();
  const rawSubjectId = (await params).subjectId;
  const parameters = await searchParams;
  if (!/^\d+$/.test(rawSubjectId)) notFound();
  const subjectId = Number(rawSubjectId);
  const projectsEnabled = isProjectsFeatureEnabled();
  const views = projectsEnabled
    ? baseViews
    : baseViews.filter(([key]) => key !== "projects");
  const view: SubjectView = views.some(([key]) => key === parameters.view)
    ? (parameters.view as SubjectView)
    : "overview";
  let language: UiLanguage = defaultUiLanguage;
  let data;
  try {
    language = getUiLanguage();
    const offerings = listUserSubjectOfferings(user.id).filter(
      (offering) => offering.subjectId === subjectId,
    );
    const offeringIds = new Set(offerings.map(({ offeringId }) => offeringId));
    data = {
      subject: getSubject(subjectId),
      offerings,
      slots: listUserAgenda(user.id).filter(
        (slot) => slot.subjectId === subjectId,
      ),
      feed: listUserSubjectFeed(user.id, subjectId),
      activities: listUserActivities(user.id).filter(({ offeringId }) =>
        offeringIds.has(offeringId),
      ),
      notes: listUserNotes(user.id).filter(
        ({ offeringId }) => offeringId !== null && offeringIds.has(offeringId),
      ),
      documents: listUserGeneratedDocuments(user.id).filter(({ offeringId }) =>
        offeringIds.has(offeringId),
      ),
      projects: projectsEnabled
        ? offerings.flatMap(({ offeringId }) =>
            listUserProjects(user.id, offeringId),
          )
        : [],
      classroomFeed: offerings.flatMap(({ offeringId }) =>
        listClassroomFeedItems(user.id, offeringId),
      ),
    };
  } catch {
    return (
      <div className="academic-shell">
        <div className="useful-empty" role="alert">
          <strong>Não foi possível carregar a disciplina</strong>
          <p>Confirme as migrations e tente novamente.</p>
        </div>
      </div>
    );
  }
  if (!data.subject || data.offerings.length === 0) notFound();

  const { academic } = getTranslations(language);
  const {
    subject,
    offerings,
    slots,
    feed,
    activities,
    notes,
    documents,
    projects,
    classroomFeed,
  } = data;
  const nextItem = findNextSubjectFeedItem(feed);
  const integrations = new Map(
    listOfferingGoogleIntegrations(
      offerings.map(({ offeringId }) => offeringId),
    ).map((integration) => [integration.offeringId, integration]),
  );
  const v2Mode = process.env.OPENSTUDYHUB_V2_ENABLED === "1";
  const googleConnected =
    !v2Mode && getGoogleConnection(user.id)?.status === "connected";
  const mappedOfferingIds = offerings
    .filter(({ offeringId }) => integrations.get(offeringId)?.classroomCourseId)
    .map(({ offeringId }) => offeringId);
  const syncStates = mappedOfferingIds
    .map((offeringId) => getClassroomSyncState(user.id, offeringId))
    .filter(Boolean);
  const lastSync = syncStates.reduce<number | null>(
    (latest, state) =>
      Math.max(latest ?? 0, state?.lastSuccessfulSyncAt ?? 0) || null,
    null,
  );
  const weekdayLabels = [
    academic.monday,
    academic.tuesday,
    academic.wednesday,
    academic.thursday,
    academic.friday,
    academic.saturday,
    academic.sunday,
  ];
  const primaryOffering = offerings[0];
  const groupedActivities = activityGroups(activities);
  const dateFormatter = new Intl.DateTimeFormat(language, {
    dateStyle: "medium",
    timeStyle: "short",
  });

  return (
    <div className="academic-shell subject-workspace">
      {googleConnected ? (
        <SubjectAutoSync offeringIds={mappedOfferingIds} />
      ) : null}
      <header className="academic-heading subject-detail-heading">
        <div>
          <p className="system-label">DISCIPLINA</p>
          <span className="page-kicker">{subject.code ?? "SEM CÓDIGO"}</span>
          <h1>{subject.name}</h1>
          <p className="page-description">
            {offerings
              .map(
                (offering) =>
                  `${offering.programShortName ?? offering.programName} · ${offering.periodLabel}${offering.classGroup ? ` · ${offering.classGroup}` : ""}`,
              )
              .join(" / ")}
          </p>
          {mappedOfferingIds.length ? (
            <span className="sync-status">
              Classroom ·{" "}
              {lastSync
                ? `sync ${dateFormatter.format(lastSync)}`
                : "aguardando sync"}
            </span>
          ) : null}
        </div>
        <Link href="/subjects">← Disciplinas</Link>
      </header>

      <nav
        className="section-tabs subject-tabs"
        aria-label="Áreas da disciplina"
      >
        {views.map(([key, label]) => (
          <Link
            key={key}
            href={`/subjects/${subjectId}?view=${key}`}
            aria-current={view === key ? "page" : undefined}
          >
            {label}
          </Link>
        ))}
      </nav>

      {parameters.google === "error" ? (
        <p className="feedback-banner is-error" role="alert">
          O Classroom não respondeu. O cache local foi preservado.
        </p>
      ) : parameters.google === "synced" ? (
        <p className="feedback-banner is-success" role="status">
          Conteúdo local atualizado a partir do Classroom.
        </p>
      ) : null}

      {view === "overview" ? (
        <>
          <section
            className="subject-next"
            aria-labelledby="subject-next-title"
          >
            <span>PRÓXIMO</span>
            {nextItem ? (
              <>
                <div>
                  <strong id="subject-next-title">{nextItem.title}</strong>
                  <small>{nextItem.sourceLabel}</small>
                </div>
                <time dateTime={new Date(nextItem.relevantAt).toISOString()}>
                  {formatAcademicDateTime(nextItem.relevantAt, language)}
                </time>
                {nextItem.href ? (
                  nextItem.external ? (
                    <a href={nextItem.href} target="_blank" rel="noreferrer">
                      Abrir ↗
                    </a>
                  ) : (
                    <Link href={nextItem.href}>Ver detalhes →</Link>
                  )
                ) : null}
              </>
            ) : (
              <div>
                <strong id="subject-next-title">Nada urgente por aqui</strong>
                <small>Novas aulas e prazos aparecerão neste espaço.</small>
              </div>
            )}
          </section>

          <section className="subject-actions" aria-label="Ações da disciplina">
            <Link
              className="action-button is-primary"
              href={`/notes?offeringId=${primaryOffering.offeringId}#nova-nota`}
            >
              + Nova nota
            </Link>
            <Link
              className="action-button"
              href={`/documents?view=generate&offeringId=${primaryOffering.offeringId}`}
            >
              Gerar documento
            </Link>
            {projectsEnabled ? (
              <Link
                className="action-button"
                href={`/subjects/${subjectId}?view=projects#novo-projeto`}
              >
                Novo projeto
              </Link>
            ) : null}
            {offerings.map((offering) => {
              const integration = integrations.get(offering.offeringId);
              return integration ? (
                <div
                  className="subject-integration-actions"
                  key={offering.offeringId}
                >
                  {integration.driveFolderId ? (
                    <a
                      className="action-button"
                      href={`https://drive.google.com/drive/folders/${encodeURIComponent(integration.driveFolderId)}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Abrir Drive ↗
                    </a>
                  ) : null}
                  {integration.notebookUrl ? (
                    <a
                      className="action-button"
                      href={integration.notebookUrl}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Abrir Notebook ↗
                    </a>
                  ) : null}
                  {v2Mode && integration.classroomCourseId ? (
                    <Link className="action-button" href="/google">
                      Gerenciar meu Classroom
                    </Link>
                  ) : integration.classroomCourseId ? (
                    <div className="classroom-sync-actions">
                      <form action={syncClassroomActivitiesAction}>
                        <input
                          type="hidden"
                          name="subjectId"
                          value={subjectId}
                        />
                        <input
                          type="hidden"
                          name="offeringId"
                          value={offering.offeringId}
                        />
                        <button
                          className="action-button"
                          type="submit"
                          disabled={!googleConnected}
                        >
                          Sincronizar agora
                        </button>
                      </form>
                      <details className="secondary-action-disclosure">
                        <summary>Histórico</summary>
                        <form action={syncClassroomActivitiesAction}>
                          <input
                            type="hidden"
                            name="subjectId"
                            value={subjectId}
                          />
                          <input
                            type="hidden"
                            name="offeringId"
                            value={offering.offeringId}
                          />
                          <input
                            type="hidden"
                            name="includeHistory"
                            value="true"
                          />
                          <button
                            className="action-button is-secondary"
                            type="submit"
                            disabled={!googleConnected}
                          >
                            Importar histórico anterior
                          </button>
                        </form>
                      </details>
                    </div>
                  ) : null}
                </div>
              ) : null;
            })}
          </section>

          <div className="subject-workspace-grid">
            <section
              className="timeline-panel human-timeline"
              aria-labelledby="timeline-title"
            >
              <div className="section-heading">
                <div>
                  <span className="page-kicker">ATIVIDADE RECENTE</span>
                  <h2 id="timeline-title">Timeline</h2>
                </div>
                <span className="count-label">{feed.length}</span>
              </div>
              {feed.length === 0 ? (
                <div className="useful-empty compact">
                  <strong>Ainda não há atividade nesta matéria</strong>
                  <p>Notas, documentos, projetos e eventos aparecerão aqui.</p>
                </div>
              ) : (
                <ol className="timeline-list">
                  {feed.map((item) => (
                    <li key={item.key} className={`timeline-kind-${item.kind}`}>
                      <div className="timeline-marker" aria-hidden="true" />
                      <div className="timeline-time">
                        <span>{item.sourceLabel}</span>
                        <time
                          dateTime={new Date(item.occurredAt).toISOString()}
                        >
                          {formatAcademicDateTime(item.occurredAt, language)}
                        </time>
                      </div>
                      <div className="timeline-content">
                        <h3>{item.title}</h3>
                        {item.description ? <p>{item.description}</p> : null}
                        {item.status ? (
                          <span>{item.status.replaceAll("_", " ")}</span>
                        ) : null}
                        {item.href ? (
                          item.external ? (
                            <a
                              href={item.href}
                              target="_blank"
                              rel="noreferrer"
                            >
                              Abrir ↗
                            </a>
                          ) : (
                            <Link href={item.href}>Abrir →</Link>
                          )
                        ) : null}
                      </div>
                    </li>
                  ))}
                </ol>
              )}
            </section>
            <SubjectSidebar
              slots={slots}
              offerings={offerings}
              weekdayLabels={weekdayLabels}
            />
          </div>
        </>
      ) : null}

      {view === "wall" ? (
        <section className="utility-panel subject-context-panel">
          <div className="panel-title">MURAL DO CLASSROOM</div>
          {classroomFeed.length === 0 ? (
            <div className="useful-empty">
              <strong>Nada no mural local</strong>
              <p>Conecte e mapeie o Classroom ou use Sincronizar agora.</p>
            </div>
          ) : (
            <ol className="classroom-wall">
              {classroomFeed.map((item) => (
                <li key={`${item.offeringId}:${item.type}:${item.id}`}>
                  <span className="status-badge">{item.type}</span>
                  <div>
                    <strong>{item.title}</strong>
                    {item.publishedAt ? (
                      <time>{dateFormatter.format(item.publishedAt)}</time>
                    ) : null}
                    {item.excerpt ? (
                      item.excerpt.length > 180 ? (
                        <details>
                          <summary>
                            {item.excerpt.slice(0, 180)}… Ver mais
                          </summary>
                          <p>{item.excerpt}</p>
                        </details>
                      ) : (
                        <p>{item.excerpt}</p>
                      )
                    ) : null}
                  </div>
                  {item.externalUrl ? (
                    <a href={item.externalUrl} target="_blank" rel="noreferrer">
                      Classroom ↗
                    </a>
                  ) : null}
                </li>
              ))}
            </ol>
          )}
        </section>
      ) : null}

      {view === "activities" ? (
        <section className="utility-panel subject-context-panel">
          <div className="panel-title">ATIVIDADES</div>
          <div className="context-actions">
            <Link
              href={`/activities?offeringId=${primaryOffering.offeringId}#nova-atividade`}
            >
              + Activity manual
            </Link>
          </div>
          {(
            [
              ["Esta semana", groupedActivities.week],
              ["Próximas · 14 dias", groupedActivities.next],
              ["Sem prazo", groupedActivities.noDeadline],
              ["Mais tarde", groupedActivities.later],
              ["Histórico", groupedActivities.history],
            ] as const
          ).map(([label, items]) => (
            <details
              className="activity-time-group"
              key={label}
              open={label !== "Histórico" && items.length > 0}
            >
              <summary>
                {label} <span>{items.length}</span>
              </summary>
              {items.length ? (
                <ol className="subject-context-list">
                  {items.map((item) => (
                    <li key={item.id}>
                      <div>
                        <strong>{item.title}</strong>
                        <span>
                          {item.origin === "external"
                            ? "Classroom"
                            : item.status}
                        </span>
                        {item.description ? (
                          item.description.length > 180 ? (
                            <details className="activity-excerpt">
                              <summary>
                                {item.description.slice(0, 180)}… Ver mais
                              </summary>
                              <p>{item.description}</p>
                            </details>
                          ) : (
                            <p>{item.description}</p>
                          )
                        ) : null}
                      </div>
                      <time>
                        {item.dueAt
                          ? dateFormatter.format(item.dueAt)
                          : "Sem prazo"}
                      </time>
                      <div className="context-actions">
                        <Link
                          href={`/notes?offeringId=${item.offeringId}&activityId=${item.id}#nova-nota`}
                        >
                          Nota
                        </Link>
                        <Link
                          href={`/documents?view=generate&offeringId=${item.offeringId}&activityId=${item.id}`}
                        >
                          Documento
                        </Link>
                        {item.externalUrl ? (
                          <a
                            href={item.externalUrl}
                            target="_blank"
                            rel="noreferrer"
                          >
                            Classroom ↗
                          </a>
                        ) : null}
                      </div>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="panel-help">Nenhum item nesta faixa.</p>
              )}
            </details>
          ))}
        </section>
      ) : null}

      {view === "notes" ? (
        <section className="utility-panel subject-context-panel">
          <div className="panel-title">NOTAS DESTA DISCIPLINA</div>
          <div className="context-actions">
            <Link
              href={`/notes?offeringId=${primaryOffering.offeringId}#nova-nota`}
            >
              + Nova nota
            </Link>
          </div>
          {notes.length ? (
            <ol className="subject-context-list">
              {notes.map((note) => (
                <li key={note.id}>
                  <Link href={`/notes/${note.id}`}>
                    <strong>{note.title}</strong>
                    <span>{dateFormatter.format(note.updatedAt)}</span>
                  </Link>
                </li>
              ))}
            </ol>
          ) : (
            <div className="useful-empty compact">
              <strong>Nenhuma nota nesta disciplina</strong>
            </div>
          )}
        </section>
      ) : null}

      {view === "documents" ? (
        <section className="utility-panel subject-context-panel">
          <div className="panel-title">DOCUMENTOS DESTA DISCIPLINA</div>
          <div className="context-actions">
            <Link
              href={`/documents?view=generate&offeringId=${primaryOffering.offeringId}`}
            >
              + Gerar documento
            </Link>
          </div>
          {documents.length ? (
            <ol className="subject-context-list">
              {documents.map((document) => (
                <li key={document.id}>
                  <a
                    href={document.webViewLink}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <strong>{document.name}</strong>
                    <span>{document.templateName ?? "Documento"}</span>
                  </a>
                </li>
              ))}
            </ol>
          ) : (
            <div className="useful-empty compact">
              <strong>Nenhum documento gerado</strong>
            </div>
          )}
        </section>
      ) : null}

      {view === "projects" ? (
        <div className="subject-projects-layout">
          <section className="utility-panel subject-context-panel">
            <div className="panel-title">
              <span>PROJETOS</span>
              <span>{projects.length.toString().padStart(2, "0")}</span>
            </div>
            {parameters.status === "archived" ? (
              <p className="feedback-banner is-success" role="status">
                Projeto arquivado localmente. O conteúdo no Drive foi mantido.
              </p>
            ) : null}
            {projects.length ? (
              <ol className="project-card-list">
                {projects.map((project) => (
                  <li key={project.id}>
                    <div className="project-card-summary">
                      <strong>{project.name}</strong>
                      <span>
                        {project.technologies.length
                          ? project.technologies
                              .map((item) => projectTechnologyLabels[item])
                              .join(" · ")
                          : projectLanguageLabels[project.language]}
                      </span>
                      <span>
                        v{String(project.currentVersionNumber).padStart(4, "0")}
                      </span>
                      <span className="status-badge">
                        {
                          {
                            prepared: "Inicial",
                            syncing: "Sincronizando",
                            complete: "Sincronizado",
                            failed: "Pendente",
                          }[project.syncStatus]
                        }
                      </span>
                    </div>
                    <div className="context-actions">
                      <Link href={`/projects/${project.id}`}>Atualizar</Link>
                      {project.currentVersionNumber > 0 ? (
                        <a
                          href={`/api/projects/${project.id}/versions/${project.currentVersionNumber}/download`}
                        >
                          Baixar
                        </a>
                      ) : null}
                      {project.driveProjectFolderId ? (
                        <a
                          href={`https://drive.google.com/drive/folders/${encodeURIComponent(project.driveProjectFolderId)}`}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Abrir Drive ↗
                        </a>
                      ) : null}
                      <Link href={`/projects/${project.id}#versions`}>
                        Versões
                      </Link>
                    </div>
                  </li>
                ))}
              </ol>
            ) : (
              <div className="useful-empty compact">
                <strong>Nenhum projeto nesta disciplina</strong>
                <p>Crie o registro e envie sua pasta local ou um ZIP.</p>
              </div>
            )}
          </section>
          <details
            className="utility-panel new-project-panel"
            id="novo-projeto"
          >
            <summary>NOVO PROJETO</summary>
            <p className="panel-help">
              Primeiro crie o registro. O envio da pasta ou ZIP acontece na
              etapa seguinte.
            </p>
            <form action={createProjectAction} className="workflow-form">
              <input
                type="hidden"
                name="offeringId"
                value={primaryOffering.offeringId}
              />
              <label className="wide-field">
                Nome
                <input name="name" maxLength={160} required />
              </label>
              <label>
                Tecnologia principal / preset
                <select name="language" defaultValue="other">
                  {projectLanguages.map((option) => (
                    <option key={option} value={option}>
                      {projectLanguageLabels[option]}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Ignore preset principal
                <select name="ignorePreset" defaultValue="other">
                  <option value="other">Automático / recomendado</option>
                  {projectLanguages.map((option) =>
                    option === "other" ? null : (
                      <option key={option} value={option}>
                        {projectLanguageLabels[option]}
                      </option>
                    ),
                  )}
                </select>
              </label>
              <fieldset className="wide-field technology-picker">
                <legend>Tecnologias / Stack</legend>
                <div>
                  {projectTechnologies.map((technology) => (
                    <label className="checkbox-label" key={technology}>
                      <input
                        type="checkbox"
                        name="technologies"
                        value={technology}
                      />
                      {projectTechnologyLabels[technology]}
                    </label>
                  ))}
                </div>
              </fieldset>
              <label className="wide-field">
                Descrição (opcional)
                <textarea name="description" maxLength={1000} rows={4} />
              </label>
              <button type="submit">Criar projeto</button>
            </form>
          </details>
        </div>
      ) : null}
    </div>
  );
}

function SubjectSidebar({
  slots,
  offerings,
  weekdayLabels,
}: {
  slots: ReturnType<typeof listUserAgenda>;
  offerings: ReturnType<typeof listUserSubjectOfferings>;
  weekdayLabels: string[];
}) {
  return (
    <aside className="subject-sidebar">
      <section className="utility-panel">
        <div className="panel-title">
          <span>AULAS</span>
          <span>{slots.length}</span>
        </div>
        {slots.length === 0 ? (
          <div className="useful-empty compact">
            <strong>Sem horário cadastrado</strong>
          </div>
        ) : (
          <ol className="subject-slot-list">
            {slots.map((slot) => (
              <li key={slot.slotId}>
                <strong>
                  {weekdayLabels[slot.weekday - 1]} ·{" "}
                  {formatMinutes(slot.startsAtMinutes)}
                </strong>
                <span>
                  até {formatMinutes(slot.endsAtMinutes)}
                  {joinLocation([slot.locationName])
                    ? ` · ${joinLocation([slot.locationName])}`
                    : ""}
                </span>
              </li>
            ))}
          </ol>
        )}
      </section>
      <section className="utility-panel">
        <div className="panel-title">CONTEXTO</div>
        <dl className="subject-meta-list">
          {offerings.map((offering) => (
            <div key={offering.offeringId}>
              <dt>{offering.programShortName ?? offering.programName}</dt>
              <dd>
                {offering.periodLabel}
                {offering.classGroup ? ` · ${offering.classGroup}` : ""}
              </dd>
              <dd>{offering.instructorName ?? "Professor não informado"}</dd>
            </div>
          ))}
        </dl>
      </section>
    </aside>
  );
}
