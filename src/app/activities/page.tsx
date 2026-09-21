import Link from "next/link";

import {
  createActivityAction,
  setActivityStatusAction,
  updateActivityAction,
} from "@/app/activities/actions";
import { listUserSubjectOfferings } from "@/lib/academic";
import { listUserActivities } from "@/lib/activities";
import { requireAuthenticatedUser } from "@/lib/authorization";
import { getUserProfile } from "@/lib/profile";
import { getTranslations } from "@/lib/translations";

export const dynamic = "force-dynamic";

function datetimeLocal(timestamp: number | null): string {
  if (timestamp === null) return "";
  const date = new Date(
    timestamp - new Date(timestamp).getTimezoneOffset() * 60_000,
  );
  return date.toISOString().slice(0, 16);
}

export default async function ActivitiesPage() {
  const user = await requireAuthenticatedUser();
  const profile = getUserProfile(user.id);
  const { academic } = getTranslations(profile.locale);
  const offerings = listUserSubjectOfferings(user.id);
  const activities = listUserActivities(user.id);
  const statuses = [
    ["pending", academic.pending],
    ["in_progress", academic.inProgress],
    ["completed", academic.completed],
    ["submitted", academic.submitted],
    ["archived", academic.archived],
  ] as const;

  return (
    <div className="academic-shell">
      <header className="academic-heading">
        <div>
          <p className="system-label">{academic.activitiesSystem}</p>
          <h1>{academic.activitiesTitle}</h1>
          <p className="page-description">
            Acompanhe prazos locais e atividades sincronizadas do Classroom.
          </p>
        </div>
        <span className="count-label">
          {String(activities.length).padStart(2, "0")}
        </span>
      </header>

      <details
        className="workflow-panel create-activity-panel"
        open={activities.length === 0}
      >
        <summary>+ {academic.newActivity}</summary>
        <form className="workflow-form" action={createActivityAction}>
          <label>
            {academic.subject}
            <select name="offeringId" required defaultValue="">
              <option value="" disabled>
                —
              </option>
              {offerings.map((item) => (
                <option key={item.offeringId} value={item.offeringId}>
                  {item.subjectCode ?? "—"} / {item.subjectName} /{" "}
                  {item.periodLabel}
                </option>
              ))}
            </select>
          </label>
          <label>
            {academic.activityTitle}
            <input name="title" maxLength={160} required />
          </label>
          <label>
            {academic.dueAt}
            <input name="dueAt" type="datetime-local" />
          </label>
          <label className="wide-field">
            {academic.description}
            <textarea name="description" maxLength={1000} rows={2} />
          </label>
          <button type="submit" disabled={offerings.length === 0}>
            {academic.createActivity}
          </button>
        </form>
      </details>

      {activities.length === 0 ? (
        <div className="useful-empty">
          <strong>{academic.noActivities}</strong>
          <p>
            Crie uma Activity local ou sincronize o Classroom a partir de uma
            disciplina conectada.
          </p>
          <Link href="/subjects">Ver disciplinas</Link>
        </div>
      ) : (
        <ol className="activity-list activity-card-list">
          {activities.map((activity) => (
            <li key={activity.id}>
              <div className="activity-summary">
                <div className="activity-main">
                  <span className="activity-origin">
                    {activity.origin === "external"
                      ? "GOOGLE CLASSROOM"
                      : "LOCAL"}
                  </span>
                  <strong>{activity.title}</strong>
                  <span>{activity.subjectCode ?? activity.subjectName}</span>
                </div>
                <div className="activity-deadline">
                  <small>{academic.dueAt}</small>
                  <strong>
                    {activity.dueAt
                      ? new Intl.DateTimeFormat(profile.locale, {
                          dateStyle: "medium",
                          timeStyle: "short",
                        }).format(activity.dueAt)
                      : "Sem prazo"}
                  </strong>
                </div>
                {activity.origin === "local" ? (
                  <form action={setActivityStatusAction}>
                    <input
                      type="hidden"
                      name="activityId"
                      value={activity.id}
                    />
                    <select
                      name="status"
                      defaultValue={activity.status}
                      aria-label={academic.status}
                    >
                      {statuses.map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                    <button type="submit">{academic.saveActivity}</button>
                  </form>
                ) : (
                  <span className="status-badge">
                    {academic.externalActivity}
                  </span>
                )}
              </div>
              {activity.description ? (
                activity.description.length > 180 ? (
                  <details className="activity-description activity-excerpt">
                    <summary>
                      {activity.description.slice(0, 180)}… Ver mais
                    </summary>
                    <p>{activity.description}</p>
                  </details>
                ) : (
                  <p className="activity-description">{activity.description}</p>
                )
              ) : null}
              {activity.origin === "external" && activity.externalUrl ? (
                <a
                  className="text-link"
                  href={activity.externalUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  Abrir no {academic.classroom} ↗
                </a>
              ) : null}
              <div className="context-actions activity-context-actions">
                <Link
                  href={`/notes?offeringId=${activity.offeringId}&activityId=${activity.id}`}
                >
                  + Criar nota
                </Link>
                <Link
                  href={`/documents?offeringId=${activity.offeringId}&activityId=${activity.id}`}
                >
                  Gerar documento
                </Link>
              </div>
              {activity.origin === "local" ? (
                <details>
                  <summary>{academic.edit}</summary>
                  <form className="workflow-form" action={updateActivityAction}>
                    <input
                      type="hidden"
                      name="activityId"
                      value={activity.id}
                    />
                    <label>
                      {academic.subject}
                      <select
                        name="offeringId"
                        defaultValue={activity.offeringId}
                      >
                        {offerings.map((item) => (
                          <option key={item.offeringId} value={item.offeringId}>
                            {item.subjectName} / {item.periodLabel}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      {academic.activityTitle}
                      <input
                        name="title"
                        defaultValue={activity.title}
                        maxLength={160}
                        required
                      />
                    </label>
                    <label>
                      {academic.dueAt}
                      <input
                        name="dueAt"
                        type="datetime-local"
                        defaultValue={datetimeLocal(activity.dueAt)}
                      />
                    </label>
                    <label>
                      {academic.status}
                      <select name="status" defaultValue={activity.status}>
                        {statuses.map(([value, label]) => (
                          <option key={value} value={value}>
                            {label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="wide-field">
                      {academic.description}
                      <textarea
                        name="description"
                        defaultValue={activity.description ?? ""}
                        maxLength={1000}
                        rows={2}
                      />
                    </label>
                    <button type="submit">{academic.saveActivity}</button>
                  </form>
                </details>
              ) : null}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
