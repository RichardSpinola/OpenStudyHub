import Link from "next/link";

import { listRecentAuditEvents } from "@/lib/audit";
import { requireAdminUser } from "@/lib/authorization";
import { getTranslations } from "@/lib/translations";
import { getUiLanguage } from "@/lib/ui-language";

export const dynamic = "force-dynamic";

export default async function AdminAuditPage() {
  await requireAdminUser();
  const { admin } = getTranslations(getUiLanguage());
  const events = listRecentAuditEvents();

  return (
    <div className="admin-shell">
      <header className="admin-heading">
        <span>{admin.system}</span>
        <h1>{admin.auditTitle}</h1>
        <Link href="/admin">[ {admin.back} ]</Link>
      </header>
      <section className="admin-panel">
        <div className="section-heading">
          <span className="panel-index">01</span>
          <h2>{admin.audit}</h2>
          <span>{events.length}</span>
        </div>
        {events.length === 0 ? (
          <p className="admin-empty">{admin.noRecords}</p>
        ) : (
          <ol className="audit-list">
            {events.map((event) => (
              <li key={event.id}>
                <time dateTime={new Date(event.createdAt).toISOString()}>
                  {new Date(event.createdAt).toLocaleString(getUiLanguage())}
                </time>
                <strong>{event.action}</strong>
                <span>{event.actorDisplayName ?? "SYSTEM"}</span>
                <span>
                  {event.targetType}
                  {event.targetId ? ` #${event.targetId}` : ""}
                </span>
                {event.summary ? <small>{event.summary}</small> : null}
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}
