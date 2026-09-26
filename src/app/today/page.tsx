import { UiCopy } from "@/components/ui-language-provider";
import Link from "next/link";
import { AcademicTimeGrid } from "@/components/academic-time-grid";
import { formatMinutes, joinLocation } from "@/lib/academic-format";
import { requireAuthenticatedUser } from "@/lib/authorization";
import { getUserProfile } from "@/lib/profile";
import { getTodayData } from "@/lib/today";
import { selectTodayHighlights } from "@/lib/today-highlights";
import { getPersonalClassroomSummary } from "@/lib/v2/classroom-ui";
import { uiText } from "@/lib/translations";

export const dynamic = "force-dynamic";

export default async function TodayPage() {
  const user = await requireAuthenticatedUser();
  const profile = getUserProfile(user.id);
  const now = new Date();
  const data = getTodayData(user.id, now);
  const classroom = getPersonalClassroomSummary(user.id);
  const highlights = selectTodayHighlights(data, classroom, now);
  const weekday = now.getDay() || 7;
  const dateTime = new Intl.DateTimeFormat(profile.locale, {
    dateStyle: "short",
    timeStyle: "short",
  });
  const dateLabel = new Intl.DateTimeFormat(profile.locale, {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(now);

  return (
    <div className="academic-shell today-page">
      <header className="academic-heading today-heading">
        <div>
          <p className="system-label">
            <UiCopy pt="AGENDA" en="SCHEDULE" /> / {data.currentPeriod?.label ?? uiText(profile.locale, "SEM PERÍODO", "NO PERIOD")}
          </p>
          <h1>
            <UiCopy pt="Hoje" en="Today" />
          </h1>
          <p className="page-description">
            <UiCopy
              pt="Aulas e prazos em ordem de atenção."
              en="Classes and deadlines in order of priority."
            />
          </p>
        </div>
        <time dateTime={data.date}>{dateLabel}</time>
      </header>
      <nav className="today-glance" aria-label="Resumo da agenda">
        {highlights.event ? (
          <a href="#today-events">
            <span>
              <UiCopy pt="Evento" en="Event" />
            </span>
            <strong>{highlights.event.title}</strong>
          </a>
        ) : null}
        {highlights.deadline ? (
          <a href="#today-deadlines">
            <span>
              <UiCopy pt="Prazo" en="Deadline" />
            </span>
            <strong>{highlights.deadline.title}</strong>
          </a>
        ) : null}
        {highlights.update ? (
          <a href="#today-updates">
            <span>
              <UiCopy pt="Mural" en="Stream" />
            </span>
            <strong>{highlights.update.title}</strong>
          </a>
        ) : null}
        {highlights.nextMeeting ? (
          <a href="#today-meetings">
            <span>
              <UiCopy pt="Próximo encontro" en="Next class" />
            </span>
            <strong>{highlights.nextMeeting.subjectName}</strong>
          </a>
        ) : null}
      </nav>
      <div className="today-priority">
        {highlights.lesson ? (
          <section className="today-priority-item">
            <span className="page-kicker">
              {highlights.lessonIsToday ? uiText(profile.locale, "AULA DE HOJE", "TODAY'S CLASS") : uiText(profile.locale, "PRÓXIMO ENCONTRO", "NEXT MEETING")}
            </span>
            <strong>{highlights.lesson.subjectName}</strong>
            <span>
              {"date" in highlights.lesson
                ? `${new Intl.DateTimeFormat(profile.locale, { weekday: "short", day: "numeric", month: "short" }).format(new Date(`${highlights.lesson.date}T12:00:00`))} · `
                : ""}
              {formatMinutes(highlights.lesson.startsAtMinutes)}–
              {formatMinutes(highlights.lesson.endsAtMinutes)} ·{" "}
              {joinLocation([
                highlights.lesson.locationName,
                highlights.lesson.room,
              ]) ?? uiText(profile.locale, "Sala não informada", "Room not specified")}
            </span>
            <Link href={`/subjects/${highlights.lesson.subjectId}`}>
              <UiCopy pt="Ver disciplina →" en="View subject →" />
            </Link>
          </section>
        ) : null}
        {highlights.deadline ? (
          <section className="today-priority-item">
            <span className="page-kicker">
              <UiCopy pt="PRAZO MAIS PRÓXIMO" en="NEAREST DEADLINE" />
            </span>
            <strong>{highlights.deadline.title}</strong>
            <span>
              {dateTime.format(highlights.deadline.dueAt!)}
              {highlights.additionalDeadlines
                ? ` · +${highlights.additionalDeadlines} outro(s)`
                : ""}
            </span>
            <a href="#today-deadlines">
              <UiCopy pt="Ver atividade ↓" en="View activity ↓" />
            </a>
          </section>
        ) : null}
      </div>
      <AcademicTimeGrid slots={data.weekSlots} today={weekday} />
      <section className="workflow-panel" id="today-events">
        <div className="section-heading">
          <h2>
            <UiCopy pt="Eventos acadêmicos" en="Academic events" />
          </h2>
          <span>{data.upcomingEvents.length}</span>
        </div>
        {data.upcomingEvents.length ? (
          <ol className="today-list">
            {data.upcomingEvents.map((item) => (
              <li key={item.id}>
                <time>
                  {new Intl.DateTimeFormat(profile.locale, {
                    dateStyle: "short",
                    timeStyle: "short",
                  }).format(item.startsAt)}
                </time>
                <div>
                  <Link href={`/subjects/${item.subjectId}`}>
                    <strong>{item.title}</strong>
                  </Link>
                  <span>{item.locationName ?? item.programName}</span>
                </div>
              </li>
            ))}
          </ol>
        ) : (
          <p className="panel-help">
            <UiCopy
              pt="Nenhum evento acadêmico previsto nos próximos sete dias."
              en="No academic events scheduled in the next seven days."
            />
          </p>
        )}
      </section>
      <section className="workflow-panel" id="today-deadlines">
        <div className="section-heading">
          <h2>
            <UiCopy pt="Atividades e prazos" en="Activities and deadlines" />
          </h2>
          <span>{data.activities.length}</span>
        </div>
        {data.activities.length ? (
          <ol className="today-list">
            {data.activities.map((item) => (
              <li key={item.id}>
                <span className="status-badge">
                  {item.origin === "external" ? "Classroom" : item.status}
                </span>
                <div>
                  <Link href={`/subjects/${item.subjectId}?view=activities`}>
                    <strong>{item.title}</strong>
                  </Link>
                  <span>{item.subjectName}</span>
                </div>
                <time>
                  {item.dueAt
                    ? new Intl.DateTimeFormat(profile.locale, {
                        dateStyle: "short",
                        timeStyle: "short",
                      }).format(item.dueAt)
                    : "Sem prazo"}
                </time>
              </li>
            ))}
          </ol>
        ) : (
          <div className="useful-empty compact">
            <strong>
              <UiCopy
                pt="Nenhuma atividade pendente nos próximos dias"
                en="No pending activities in the coming days"
              />
            </strong>
            <p>
              <UiCopy
                pt="O que for cadastrado aparecerá aqui."
                en="New items will appear here."
              />
            </p>
          </div>
        )}
      </section>
      <section className="workflow-panel" id="today-updates">
        <div className="section-heading">
          <h2>
            <UiCopy pt="Atualizações do mural" en="Stream updates" />
          </h2>
          <Link href="/google">
            <UiCopy pt="Gerenciar Classroom" en="Manage Classroom" />
          </Link>
        </div>
        {classroom?.updates.length ? (
          <ol className="today-list">
            {classroom.updates.map((item) => (
              <li key={`${item.offeringId}:${item.id}`}>
                <span className="status-badge">Classroom</span>
                <div>
                  <strong>{item.title}</strong>
                  <span>{item.subjectName}</span>
                </div>
                <time>
                  {item.publishedAt
                    ? new Intl.DateTimeFormat(profile.locale, {
                        dateStyle: "short",
                      }).format(new Date(item.publishedAt))
                    : "Sem data"}
                </time>
              </li>
            ))}
          </ol>
        ) : (
          <p className="panel-help">
            <UiCopy
              pt="Nenhuma atualização de Classroom no cache local. O Hub funciona sem Google."
              en="No Classroom updates in the local cache. The Hub works without Google."
            />
          </p>
        )}
      </section>
      <section className="workflow-panel" id="today-meetings">
        <div className="section-heading">
          <h2>
            <UiCopy pt="Próximos encontros" en="Upcoming classes" />
          </h2>
          <span>{data.upcomingClasses.length}</span>
        </div>
        {data.upcomingClasses.length ? (
          <ol className="today-list">
            {data.upcomingClasses.slice(0, 8).map((item) => (
              <li key={`${item.slotId}:${item.date}`}>
                <time dateTime={item.date}>
                  {new Intl.DateTimeFormat(profile.locale, {
                    day: "numeric",
                    month: "short",
                  }).format(new Date(`${item.date}T12:00:00`))}
                </time>
                <div>
                  <Link href={`/subjects/${item.subjectId}`}>
                    <strong>{item.subjectName}</strong>
                  </Link>
                  <span>
                    {formatMinutes(item.startsAtMinutes)}–
                    {formatMinutes(item.endsAtMinutes)} ·{" "}
                    {joinLocation([item.locationName, item.room]) ??
                      uiText(profile.locale, "Sala não informada", "Room not specified")}
                  </span>
                </div>
              </li>
            ))}
          </ol>
        ) : (
          <p className="panel-help">
            <UiCopy
              pt="Nenhum encontro previsto nos próximos sete dias."
              en="No classes scheduled in the next seven days."
            />
          </p>
        )}
      </section>
    </div>
  );
}
