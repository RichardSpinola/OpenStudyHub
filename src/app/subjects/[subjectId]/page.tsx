import { UiCopy } from "@/components/ui-language-provider";
import Link from "next/link";
import { notFound } from "next/navigation";

import { NoteLibraryCard } from "@/components/note-library-card";
import { DocumentLibraryCard } from "@/components/document-library-card";
import { ProjectLibraryCard } from "@/components/project-library-card";
import {
  syncClassroomActivitiesAction,
  updateOverviewFocusAction,
} from "@/app/subjects/[subjectId]/actions";
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
import { listUserStudyGroups, listVisibleUsers } from "@/lib/collaboration";
import { listUserProjects } from "@/lib/projects";
import { isProjectsFeatureEnabled } from "@/lib/feature-flags";
import {
  getPersonalClassroomSummary,
  listPersonalClassroomFeed,
} from "@/lib/v2/classroom-ui";
import { withV2Db } from "@/lib/v2/runtime";
import { legacyOfferingIdsWithCover } from "@/lib/v2/offering-covers";
import { getAcademicPreferences } from "@/lib/academic-preferences";
import {
  findNextSubjectFeedItem,
  listUserSubjectFeed,
  type SubjectFeedItem,
} from "@/lib/subject-feed";
import { getTranslations, uiText } from "@/lib/translations";
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
const classroomTypeLabel = {
  announcement: "Aviso",
  coursework: "Atividade",
  material: "Material",
} as const;

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

function upcomingAcademicEvents(feed: SubjectFeedItem[], now = Date.now()) {
  return feed
    .filter((item) => item.kind === "academic_event" && item.relevantAt >= now)
    .sort((a, b) => a.relevantAt - b.relevantAt)
    .slice(0, 3);
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
  const v2Mode = process.env.OPENSTUDYHUB_V2_ENABLED === "1";
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
      classroomFeed: v2Mode
        ? listPersonalClassroomFeed(
            user.id,
            offerings.map(({ offeringId }) => offeringId),
          )
        : offerings.flatMap(({ offeringId }) =>
            listClassroomFeedItems(user.id, offeringId),
          ),
    };
  } catch {
    return (
      <div className="academic-shell">
        <div className="useful-empty" role="alert">
          <strong>
            <UiCopy
              pt="Não foi possível carregar a disciplina"
              en="The subject could not be loaded"
            />
          </strong>
          <p>
            <UiCopy
              pt="Esta área está temporariamente indisponível. Tente novamente em instantes."
              en="This area is temporarily unavailable. Try again shortly."
            />
          </p>
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
  const documentGroups =
    view === "documents" && documents.length
      ? listUserStudyGroups(user.id)
      : [];
  const documentPeople =
    view === "documents" && documents.length ? listVisibleUsers(user.id) : [];
  const nextItem = findNextSubjectFeedItem(feed);
  const integrations = new Map(
    listOfferingGoogleIntegrations(
      offerings.map(({ offeringId }) => offeringId),
    ).map((integration) => [integration.offeringId, integration]),
  );
  const coveredOfferings = v2Mode
    ? withV2Db((db) =>
        legacyOfferingIdsWithCover(
          db,
          offerings.map((offering) => offering.offeringId),
        ),
      )
    : new Set<number>();
  const personalClassroom = getPersonalClassroomSummary(user.id);
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
  const tr = (pt: string, en: string) => uiText(language, pt, en);
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
  const bannerOfferingId = offerings.find((offering) =>
    coveredOfferings.has(offering.offeringId),
  )?.offeringId;
  const groupedActivities = activityGroups(activities);
  const overviewFocus = getAcademicPreferences(user.id).overviewFocus;
  const recentWall = [...classroomFeed]
    .sort((a, b) => (b.publishedAt ?? 0) - (a.publishedAt ?? 0))
    .slice(0, 4);
  const upcomingEvents = upcomingAcademicEvents(feed);
  const dateFormatter = new Intl.DateTimeFormat(language, {
    dateStyle: "medium",
    timeStyle: "short",
  });

  return (
    <div className="academic-shell subject-workspace">
      {googleConnected ? (
        <SubjectAutoSync offeringIds={mappedOfferingIds} />
      ) : null}
      <header
        className="academic-heading subject-detail-heading"
        data-cover={bannerOfferingId ? "true" : undefined}
        style={
          bannerOfferingId
            ? {
                backgroundImage: `linear-gradient(90deg, rgba(0,0,0,.78), rgba(0,0,0,.12)), url('/api/subject-cover/${bannerOfferingId}')`,
              }
            : undefined
        }
      >
        <div>
          <nav
            className="subject-breadcrumb"
            aria-label={uiText(language, "Localização", "Breadcrumb")}
          >
            <Link href="/subjects">
              <UiCopy pt="Disciplinas" en="Subjects" />
            </Link>
            <span aria-hidden="true">/</span>
            <span aria-current="page">{subject.name}</span>
          </nav>
          <span className="page-kicker">
            {subject.code ?? uiText(language, "SEM CÓDIGO", "NO CODE")}
          </span>
          <h1>{subject.name}</h1>
          <p className="page-description">
            {[
              ...new Set(
                offerings.map(
                  (offering) =>
                    offering.programShortName ?? offering.programName,
                ),
              ),
            ].join(" / ")}
          </p>
          <div className="subject-header-facts">
            <span>
              {primaryOffering.instructorName ??
                tr("Professor não informado", "Instructor not specified")}
            </span>
            <span>
              {primaryOffering.classGroup
                ? tr(
                    `Turma ${primaryOffering.classGroup}`,
                    `Cohort ${primaryOffering.classGroup}`,
                  )
                : tr("Sem turma", "No cohort")}
            </span>
            <span>{primaryOffering.periodLabel}</span>
          </div>
          {mappedOfferingIds.length ? (
            <span className="sync-status">
              Classroom ·{" "}
              {lastSync
                ? `sync ${dateFormatter.format(lastSync)}`
                : tr("aguardando sync", "awaiting sync")}
            </span>
          ) : null}
          {personalClassroom ? (
            <Link className="subject-google-status" href="/google">
              <UiCopy pt="Classroom pessoal ·" en="Personal Classroom ·" />{" "}
              {personalClassroom.connection === "needs_reconnect"
                ? tr("reconectar", "reconnect")
                : personalClassroom.connection === "connected"
                  ? personalClassroom.sync === "updating"
                    ? tr("atualizando", "updating")
                    : personalClassroom.sync === "error"
                      ? tr("erro na sync", "sync error")
                      : personalClassroom.sync === "ready"
                        ? tr("atualizado", "updated")
                        : tr("conectado", "connected")
                  : tr("não conectado", "not connected")}{" "}
              →
            </Link>
          ) : null}
        </div>
      </header>

      <nav
        className="section-tabs subject-tabs"
        aria-label={uiText(language, "Áreas da disciplina", "Subject sections")}
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
          <UiCopy
            pt="O Classroom não respondeu. O cache local foi preservado."
            en="Classroom did not respond. The local cache was preserved."
          />
        </p>
      ) : parameters.google === "synced" ? (
        <p className="feedback-banner is-success" role="status">
          <UiCopy
            pt="Conteúdo local atualizado a partir do Classroom."
            en="Local content updated from Classroom."
          />
        </p>
      ) : null}

      {view === "overview" ? (
        <>
          <section
            className="subject-next"
            aria-labelledby="subject-next-title"
          >
            <span>
              <UiCopy pt="PRÓXIMO" en="NEXT" />
            </span>
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
                      <UiCopy pt="Abrir ↗" en="Open ↗" />
                    </a>
                  ) : (
                    <Link href={nextItem.href}>
                      <UiCopy pt="Ver detalhes →" en="View details →" />
                    </Link>
                  )
                ) : null}
              </>
            ) : (
              <div>
                <strong id="subject-next-title">
                  <UiCopy pt="Nada urgente por aqui" en="Nothing urgent here" />
                </strong>
                <small>
                  <UiCopy
                    pt="Novas aulas e prazos aparecerão neste espaço."
                    en="New classes and deadlines will appear here."
                  />
                </small>
              </div>
            )}
          </section>

          <div className="subject-overview-layout">
            <section
              className="subject-actions"
              aria-label={uiText(
                language,
                "Ações da disciplina",
                "Subject actions",
              )}
            >
              <h2>
                <UiCopy pt="Ações" en="Actions" />
              </h2>
              <Link
                className="action-button is-primary"
                href={`/notes?offeringId=${primaryOffering.offeringId}#nova-nota`}
              >
                <UiCopy pt="+ Nova nota" en="+ New note" />
              </Link>
              <Link
                className="action-button"
                href={`/documents?view=generate&offeringId=${primaryOffering.offeringId}`}
              >
                <UiCopy pt="Gerar documento" en="Create document" />
              </Link>
              {projectsEnabled ? (
                <Link
                  className="action-button"
                  href={`/projects/new?offeringId=${primaryOffering.offeringId}`}
                >
                  <UiCopy pt="Novo projeto" en="New project" />
                </Link>
              ) : null}
              {v2Mode ? (
                <Link className="action-button" href="/google">
                  {personalClassroom?.connection === "connected"
                    ? tr("Sincronizar Classroom", "Sync Classroom")
                    : tr("Conectar Classroom", "Connect Classroom")}
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
                        <UiCopy pt="Abrir Drive ↗" en="Open Drive ↗" />
                      </a>
                    ) : null}
                    {integration.notebookUrl ? (
                      <a
                        className="action-button"
                        href={integration.notebookUrl}
                        target="_blank"
                        rel="noreferrer"
                      >
                        <UiCopy pt="Abrir Notebook ↗" en="Open Notebook ↗" />
                      </a>
                    ) : null}
                    {!v2Mode && integration.classroomCourseId ? (
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
                            <UiCopy pt="Sincronizar agora" en="Sync now" />
                          </button>
                        </form>
                        <details className="secondary-action-disclosure">
                          <summary>
                            <UiCopy pt="Histórico" en="History" />
                          </summary>
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
                              <UiCopy
                                pt="Importar histórico anterior"
                                en="Import previous history"
                              />
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
                className="timeline-panel subject-overview-main"
                aria-labelledby="subject-overview-main-title"
              >
                <div className="section-heading">
                  <div>
                    <span className="page-kicker">
                      <UiCopy pt="VISÃO GERAL" en="OVERVIEW" />
                    </span>
                    <h2 id="subject-overview-main-title">
                      {overviewFocus === "wall"
                        ? uiText(language, "Mural recente", "Recent wall")
                        : "Timeline"}
                    </h2>
                  </div>
                  <form
                    className="subject-focus-switch"
                    action={updateOverviewFocusAction}
                    aria-label={uiText(
                      language,
                      "Conteúdo principal da Visão Geral",
                      "Main overview content",
                    )}
                  >
                    <input type="hidden" name="subjectId" value={subjectId} />
                    <button
                      type="submit"
                      name="focus"
                      value="wall"
                      aria-pressed={overviewFocus === "wall"}
                    >
                      <UiCopy pt="Mural" en="Stream" />
                    </button>
                    <button
                      type="submit"
                      name="focus"
                      value="timeline"
                      aria-pressed={overviewFocus === "timeline"}
                    >
                      <UiCopy pt="Timeline" en="Timeline" />
                    </button>
                  </form>
                </div>
                {overviewFocus === "wall" ? (
                  <div className="subject-wall-summary">
                    {recentWall.length ? (
                      <ol className="classroom-wall">
                        {recentWall.map((item) => (
                          <li
                            key={`${item.offeringId}:${item.type}:${item.id}`}
                          >
                            <span className="status-badge">
                              {classroomTypeLabel[item.type]}
                            </span>
                            <div>
                              <strong>{item.title}</strong>
                              {item.publishedAt ? (
                                <time>
                                  {dateFormatter.format(item.publishedAt)}
                                </time>
                              ) : null}
                              {item.excerpt ? <p>{item.excerpt}</p> : null}
                            </div>
                          </li>
                        ))}
                      </ol>
                    ) : (
                      <div className="useful-empty compact">
                        <strong>
                          <UiCopy
                            pt="Nenhum aviso recente nesta disciplina"
                            en="No recent announcements in this subject"
                          />
                        </strong>
                        <p>
                          <UiCopy
                            pt="O Mural completo permanece disponível. O cache local não depende de conexão ativa."
                            en="The full stream remains available. The local cache does not depend on an active connection."
                          />
                        </p>
                      </div>
                    )}
                    <Link
                      className="subject-all-link"
                      href={`/subjects/${subjectId}?view=wall`}
                    >
                      <UiCopy
                        pt="Abrir Mural completo →"
                        en="Open full stream →"
                      />
                    </Link>
                    <div className="subject-overview-support">
                      <section>
                        <h3>
                          <UiCopy pt="Próximos eventos" en="Upcoming events" />
                        </h3>
                        {upcomingEvents.length ? (
                          <ol>
                            {upcomingEvents.map((item) => (
                              <li key={item.key}>
                                <strong>{item.title}</strong>
                                <time>
                                  {formatAcademicDateTime(
                                    item.relevantAt,
                                    language,
                                  )}
                                </time>
                              </li>
                            ))}
                          </ol>
                        ) : (
                          <p>
                            <UiCopy
                              pt="Nenhum evento próximo."
                              en="No upcoming events."
                            />
                          </p>
                        )}
                      </section>
                      <section>
                        <h3>
                          <UiCopy
                            pt="Atividades próximas"
                            en="Upcoming activities"
                          />
                        </h3>
                        {groupedActivities.week.length ? (
                          <ol>
                            {groupedActivities.week.slice(0, 3).map((item) => (
                              <li key={item.id}>
                                <strong>{item.title}</strong>
                                <Link
                                  href={`/subjects/${subjectId}?view=activities`}
                                >
                                  <UiCopy
                                    pt="Ver atividade →"
                                    en="View activity →"
                                  />
                                </Link>
                              </li>
                            ))}
                          </ol>
                        ) : (
                          <p>
                            <UiCopy
                              pt="Nenhuma atividade próxima."
                              en="No upcoming activities."
                            />
                          </p>
                        )}
                      </section>
                    </div>
                  </div>
                ) : feed.length === 0 ? (
                  <div className="useful-empty compact">
                    <strong>
                      <UiCopy
                        pt="Ainda não há atividade nesta matéria"
                        en="No activity in this subject yet"
                      />
                    </strong>
                    <p>
                      <UiCopy
                        pt="Notas, documentos, projetos e eventos aparecerão aqui."
                        en="Notes, documents, projects and events will appear here."
                      />
                    </p>
                  </div>
                ) : (
                  <ol className="timeline-list">
                    {feed.map((item) => (
                      <li
                        key={item.key}
                        className={`timeline-kind-${item.kind}`}
                      >
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
                                <UiCopy pt="Abrir ↗" en="Open ↗" />
                              </a>
                            ) : (
                              <Link href={item.href}>
                                <UiCopy pt="Abrir →" en="Open →" />
                              </Link>
                            )
                          ) : null}
                        </div>
                      </li>
                    ))}
                  </ol>
                )}
              </section>
              <SubjectSidebar slots={slots} weekdayLabels={weekdayLabels} />
            </div>
          </div>
        </>
      ) : null}

      {view === "wall" ? (
        <section className="utility-panel subject-context-panel">
          <div className="panel-title">
            <UiCopy pt="MURAL DO CLASSROOM" en="CLASSROOM STREAM" />
          </div>
          {classroomFeed.length === 0 ? (
            <div className="useful-empty">
              <strong>
                <UiCopy
                  pt="Nada no mural local"
                  en="Nothing in the local stream"
                />
              </strong>
              <p>
                <UiCopy
                  pt="Conecte e mapeie o Classroom ou use Sincronizar agora."
                  en="Connect and map Classroom or use Sync now."
                />
              </p>
            </div>
          ) : (
            <ol className="classroom-wall">
              {classroomFeed.map((item) => (
                <li key={`${item.offeringId}:${item.type}:${item.id}`}>
                  <span className="status-badge">
                    {classroomTypeLabel[item.type]}
                  </span>
                  <div>
                    <strong>{item.title}</strong>
                    {item.publishedAt ? (
                      <time>{dateFormatter.format(item.publishedAt)}</time>
                    ) : null}
                    {item.excerpt ? (
                      item.excerpt.length > 180 ? (
                        <details>
                          <summary>
                            {item.excerpt.slice(0, 180)}
                            <UiCopy pt="… Ver mais" en="… See more" />
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
                      <UiCopy pt="Classroom ↗" en="Classroom ↗" />
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
          <div className="panel-title">
            <UiCopy pt="ATIVIDADES" en="ACTIVITIES" />
          </div>
          <div className="context-actions">
            <Link
              href={`/activities?offeringId=${primaryOffering.offeringId}#nova-atividade`}
            >
              <UiCopy pt="+ Nova atividade manual" en="+ New manual activity" />
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
                                {item.description.slice(0, 180)}
                                <UiCopy pt="… Ver mais" en="… See more" />
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
                          <UiCopy pt="Nota" en="Note" />
                        </Link>
                        <Link
                          href={`/documents?view=generate&offeringId=${item.offeringId}&activityId=${item.id}`}
                        >
                          <UiCopy pt="Documento" en="Document" />
                        </Link>
                        {item.externalUrl ? (
                          <a
                            href={item.externalUrl}
                            target="_blank"
                            rel="noreferrer"
                          >
                            <UiCopy pt="Classroom ↗" en="Classroom ↗" />
                          </a>
                        ) : null}
                      </div>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="panel-help">
                  <UiCopy
                    pt="Nenhum item nesta faixa."
                    en="No items in this range."
                  />
                </p>
              )}
            </details>
          ))}
        </section>
      ) : null}

      {view === "notes" ? (
        <section className="resource-collection subject-resource-collection">
          <div className="resource-collection-header">
            <div>
              <span className="page-kicker">
                <UiCopy pt="ESCRITA" en="WRITING" />
              </span>
              <h2>
                <UiCopy
                  pt="Notas desta disciplina"
                  en="Notes for this subject"
                />{" "}
                <small>{notes.length}</small>
              </h2>
            </div>
            <Link
              className="primary-link"
              href={`/notes?offeringId=${primaryOffering.offeringId}#nova-nota`}
            >
              <UiCopy pt="+ Nova nota" en="+ New note" />
            </Link>
          </div>
          {notes.length ? (
            <ol className="note-card-grid is-grid">
              {notes.map((note) => (
                <NoteLibraryCard
                  key={note.id}
                  note={note}
                  href={`/notes/${note.id}`}
                  language={language}
                />
              ))}
            </ol>
          ) : (
            <div className="useful-empty resource-empty compact">
              <strong>
                <UiCopy
                  pt="Suas notas desta disciplina aparecerão aqui"
                  en="Your notes for this subject will appear here"
                />
              </strong>
              <p>
                <UiCopy
                  pt="Comece por um resumo, uma dúvida ou um rascunho."
                  en="Start with a summary, a question or a draft."
                />
              </p>
            </div>
          )}
        </section>
      ) : null}

      {view === "documents" ? (
        <section className="resource-collection subject-resource-collection">
          <div className="resource-collection-header">
            <div>
              <span className="page-kicker">
                <UiCopy pt="ARQUIVOS" en="FILES" />
              </span>
              <h2>
                <UiCopy
                  pt="Documentos desta disciplina"
                  en="Documents for this subject"
                />{" "}
                <small>{documents.length}</small>
              </h2>
            </div>
            <Link
              className="primary-link"
              href={`/documents?view=generate&offeringId=${primaryOffering.offeringId}`}
            >
              <UiCopy pt="+ Gerar documento" en="+ Create document" />
            </Link>
          </div>
          {documents.length ? (
            <ol className="document-library-grid is-grid">
              {documents.map((document) => (
                <DocumentLibraryCard
                  key={document.id}
                  document={document}
                  groups={documentGroups}
                  people={documentPeople}
                  language={language}
                />
              ))}
            </ol>
          ) : (
            <div className="useful-empty resource-empty compact">
              <strong>
                <UiCopy
                  pt="Seus documentos desta disciplina aparecerão aqui"
                  en="Your documents for this subject will appear here"
                />
              </strong>
              <p>
                <UiCopy
                  pt="Escolha um modelo e crie um documento para começar."
                  en="Choose a template and create a document to start."
                />
              </p>
            </div>
          )}
        </section>
      ) : null}

      {view === "projects" ? (
        <div className="subject-projects-layout">
          <section className="resource-collection subject-resource-collection">
            <div className="resource-collection-header">
              <div>
                <span className="page-kicker">
                  <UiCopy pt="ARQUIVOS E VERSÕES" en="FILES AND VERSIONS" />
                </span>
                <h2>
                  <UiCopy
                    pt="Projetos desta disciplina"
                    en="Projects for this subject"
                  />{" "}
                  <small>{projects.length}</small>
                </h2>
              </div>
              <Link
                className="primary-link"
                href={`/projects/new?offeringId=${primaryOffering.offeringId}`}
              >
                <UiCopy pt="+ Novo projeto" en="+ New project" />
              </Link>
            </div>
            {parameters.status === "archived" ? (
              <p className="feedback-banner is-success" role="status">
                <UiCopy
                  pt="Projeto arquivado localmente. O conteúdo no Drive foi mantido."
                  en="Project archived locally. Drive content was kept."
                />
              </p>
            ) : null}
            {projects.length ? (
              <ul className="project-library-grid is-grid">
                {projects.map((project) => (
                  <ProjectLibraryCard
                    key={project.id}
                    project={project}
                    language={language}
                  />
                ))}
              </ul>
            ) : (
              <div className="useful-empty compact">
                <strong>
                  <UiCopy
                    pt="Nenhum projeto nesta disciplina"
                    en="No projects in this subject"
                  />
                </strong>
                <p>
                  <UiCopy
                    pt="Crie o registro e envie sua pasta local ou um ZIP."
                    en="Create the record and upload a local folder or ZIP."
                  />
                </p>
              </div>
            )}
          </section>
        </div>
      ) : null}
    </div>
  );
}

function SubjectSidebar({
  slots,
  weekdayLabels,
}: {
  slots: ReturnType<typeof listUserAgenda>;
  weekdayLabels: string[];
}) {
  return (
    <aside className="subject-sidebar">
      <section className="utility-panel">
        <div className="panel-title">
          <span>
            <UiCopy pt="AULAS" en="CLASSES" />
          </span>
          <span>{slots.length}</span>
        </div>
        {slots.length === 0 ? (
          <div className="useful-empty compact">
            <strong>
              <UiCopy pt="Sem horário cadastrado" en="No scheduled time" />
            </strong>
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
    </aside>
  );
}
