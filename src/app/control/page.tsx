import { UiCopy } from "@/components/ui-language-provider";
import Link from "next/link";
import { redirect } from "next/navigation";
import { withV2DbAsync, currentAdminV2 } from "@/lib/v2/runtime";
import { isSetupPending } from "@/lib/v2/auth";
import { ConsoleShell } from "./ui";
import { presenceSummary } from "@/lib/v2/presence";
import { getUiLanguage } from "@/lib/ui-language";

export default async function ControlHome() {
  return withV2DbAsync(async (db) => {
    if (isSetupPending(db)) redirect("/control/setup");
    const actor = await currentAdminV2(db);
    if (!actor) redirect("/control/login");
    if (actor.mustChangePassword) redirect("/control/password");
    const institutions = db
      .prepare(
        `SELECT i.id,i.name,i.archived_at archivedAt,
        (SELECT count(*) FROM programs p WHERE p.institution_id=i.id AND p.archived_at IS NULL) courses
       FROM institutions i ORDER BY i.name`,
      )
      .all() as Array<{
      id: number;
      name: string;
      archivedAt: number | null;
      courses: number;
    }>;
    const users = (
      db.prepare("SELECT count(*) n FROM users WHERE active=1").get() as {
        n: number;
      }
    ).n;
    const periods = db
      .prepare(
        `SELECT i.name institution,p.label FROM academic_periods p JOIN institutions i ON i.id=p.institution_id
       WHERE p.archived_at IS NULL AND p.starts_on<=date('now') AND p.ends_on>=date('now') ORDER BY i.name`,
      )
      .all() as Array<{ institution: string; label: string }>;
    const pending = (
      db
        .prepare("SELECT count(*) n FROM cohort_periods WHERE state='planned'")
        .get() as { n: number }
    ).n;
    const presence = presenceSummary(db);
    const english = getUiLanguage() === "en";
    const tr = (pt: string, en: string) => (english ? en : pt);
    return (
      <ConsoleShell
        title={tr("Visão geral", "Overview")}
        kicker={tr("ADMINISTRAÇÃO DA INSTÂNCIA", "INSTANCE ADMINISTRATION")}
        name={actor.name}
        admin
        active="overview"
      >
        <p>
          {tr(
            "Abra uma instituição para administrar seus cursos e cadastros.",
            "Open an institution to manage its courses and records.",
          )}
        </p>
        <div
          className="admin-overview-facts"
          aria-label={tr("Estado da instância", "Instance status")}
        >
          <span>
            <strong>{institutions.length}</strong>{" "}
            {tr("instituições", "institutions")}
          </span>
          <span>
            <strong>
              {institutions.reduce((total, item) => total + item.courses, 0)}
            </strong>{" "}
            {tr("cursos ativos", "active courses")}
          </span>
          <span>
            <strong>{users}</strong> {tr("usuários ativos", "active users")}
          </span>
          <span>
            <strong>{presence.online}</strong>{" "}
            {tr("online agora", "online now")}
          </span>
        </div>
        <div
          className="admin-presence-windows"
          aria-label={tr(
            "Atividade recente dos usuários",
            "Recent user activity",
          )}
        >
          <span>
            15 min: <strong>{presence.last15Minutes}</strong>
          </span>
          <span>
            1 h: <strong>{presence.lastHour}</strong>
          </span>
          <span>
            24 h: <strong>{presence.lastDay}</strong>
          </span>
          <span>
            <UiCopy pt="7 dias:" en="7 days:" />{" "}
            <strong>{presence.lastWeek}</strong>
          </span>
        </div>
        <section aria-labelledby="control-institutions-title">
          <div className="admin-section-header">
            <h2 id="control-institutions-title">
              {tr("Instituições", "Institutions")}
            </h2>
            <Link href="/control/institutions">
              {tr("Ver todas", "View all")} →
            </Link>
          </div>
          <div className="admin-entity-list">
            {institutions.map((item) => (
              <Link
                key={item.id}
                href={`/control/institutions/${item.id}`}
                className="admin-entity-link"
              >
                <strong>{item.name}</strong>
                <span>
                  {item.courses} {tr("curso(s)", "course(s)")}
                  {item.archivedAt ? tr(" · Arquivada", " · Archived") : ""}
                </span>
                <span aria-hidden="true">→</span>
              </Link>
            ))}
          </div>
        </section>
        <section aria-labelledby="control-attention-title">
          <h2 id="control-attention-title">{tr("Acompanhar", "Follow up")}</h2>
          <p>
            {periods.length
              ? periods
                  .map((item) => `${item.institution}: ${item.label}`)
                  .join(" · ")
              : tr(
                  "Nenhum período letivo atual cadastrado.",
                  "No current academic period is registered.",
                )}
          </p>
          {pending ? (
            <p>
              {pending}{" "}
              {tr(
                "turma(s) com próximo período preparado.",
                "cohort(s) with the next period prepared.",
              )}{" "}
              <Link href="/control/institutions">
                {tr("Revisar por curso", "Review by course")} →
              </Link>
            </p>
          ) : null}
        </section>
        <nav
          className="admin-common-tasks"
          aria-label={tr("Tarefas comuns", "Common tasks")}
        >
          <Link href="/control/institutions">
            {tr("Administrar instituições", "Manage institutions")}
          </Link>
          <Link href="/control/users">
            {tr("Gerenciar usuários", "Manage users")}
          </Link>
          <Link href="/control/grants">
            {tr("Delegar responsabilidades", "Delegate responsibilities")}
          </Link>
        </nav>
      </ConsoleShell>
    );
  });
}
