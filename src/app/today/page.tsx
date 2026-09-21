import Link from "next/link";

import { formatMinutes } from "@/lib/academic-format";
import { requireAuthenticatedUser } from "@/lib/authorization";
import { getUserProfile } from "@/lib/profile";
import { getTodayData } from "@/lib/today";
import { getTranslations } from "@/lib/translations";

export const dynamic = "force-dynamic";

export default async function TodayPage() {
  const user = await requireAuthenticatedUser();
  const profile = getUserProfile(user.id);
  const { academic } = getTranslations(profile.locale);
  const data = getTodayData(user.id);
  const dateFormatter = new Intl.DateTimeFormat(profile.locale, {
    dateStyle: "medium",
  });

  return (
    <div className="academic-shell">
      <header className="academic-heading">
        <div>
          <p className="system-label">{academic.todaySystem}</p>
          <h1>{academic.todayTitle}</h1>
          <p className="page-description">O que merece sua atenção agora.</p>
        </div>
        <time dateTime={data.date} className="count-label">
          {dateFormatter.format(new Date(`${data.date}T12:00:00`))}
        </time>
      </header>
      <div className="today-grid">
        <section className="workflow-panel">
          <div className="section-heading">
            <h2>{academic.todayClasses}</h2>
            <span>{data.classes.length}</span>
          </div>
          {data.classes.length === 0 ? (
            <div className="useful-empty compact">
              <strong>{academic.noClassesToday}</strong>
              <p>Consulte abaixo os próximos encontros da semana.</p>
            </div>
          ) : (
            <ol className="today-list">
              {data.classes.map((item) => (
                <li key={item.slotId}>
                  <time>
                    {formatMinutes(item.startsAtMinutes)}–
                    {formatMinutes(item.endsAtMinutes)}
                  </time>
                  <div>
                    <Link href={`/subjects/${item.subjectId}`}>
                      <strong>{item.subjectName}</strong>
                    </Link>
                    <span>{item.classGroup ?? item.periodLabel}</span>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </section>
        <section className="workflow-panel">
          <div className="section-heading">
            <h2>{academic.todayActivities}</h2>
            <span>{data.activities.length}</span>
          </div>
          {data.activities.length === 0 ? (
            <div className="useful-empty compact">
              <strong>{academic.noPendingActivities}</strong>
              <p>Você está em dia nos próximos sete dias.</p>
            </div>
          ) : (
            <ol className="today-list">
              {data.activities.map((item) => (
                <li key={item.id}>
                  <span className="status-badge">
                    {item.origin === "external" ? "CLASSROOM" : item.status}
                  </span>
                  <div>
                    <Link href={`/subjects/${item.subjectId}?view=activities`}>
                      <strong>{item.title}</strong>
                    </Link>
                    <span>{item.subjectCode ?? item.subjectName}</span>
                  </div>
                  <time>
                    {item.dueAt
                      ? new Intl.DateTimeFormat(profile.locale, {
                          dateStyle: "short",
                          timeStyle: "short",
                        }).format(item.dueAt)
                      : "—"}
                  </time>
                </li>
              ))}
            </ol>
          )}
          <Link className="panel-link" href="/activities#nova-atividade">
            + Criar Activity manual
          </Link>
        </section>
        <section className="workflow-panel today-agenda-panel">
          <div className="section-heading">
            <h2>Próximos 7 dias</h2>
            <span>{data.upcomingClasses.length}</span>
          </div>
          {data.upcomingClasses.length === 0 ? (
            <div className="useful-empty compact">
              <strong>Sem aulas previstas</strong>
              <p>A agenda compacta usa os horários locais cadastrados.</p>
            </div>
          ) : (
            <ol className="today-list compact-agenda">
              {data.upcomingClasses.map((item) => (
                <li key={`${item.slotId}:${item.date}`}>
                  <time dateTime={item.date}>
                    {dateFormatter.format(new Date(`${item.date}T12:00:00`))}
                  </time>
                  <div>
                    <Link href={`/subjects/${item.subjectId}`}>
                      <strong>{item.subjectName}</strong>
                    </Link>
                    <span>
                      {formatMinutes(item.startsAtMinutes)}–
                      {formatMinutes(item.endsAtMinutes)}
                    </span>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>
    </div>
  );
}
