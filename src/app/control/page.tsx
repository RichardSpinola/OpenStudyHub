import { UiCopy } from "@/components/ui-language-provider";
import Link from "next/link";
import { redirect } from "next/navigation";
import { withV2DbAsync, currentAdminV2 } from "@/lib/v2/runtime";
import { isSetupPending } from "@/lib/v2/auth";
import { GettingStarted } from "./getting-started";
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
    const grantCount = (
      db
        .prepare(
          "SELECT count(*) n FROM permission_grants WHERE revoked_at IS NULL",
        )
        .get() as { n: number }
    ).n;
    const connected = (
      db
        .prepare(
          "SELECT count(*) n FROM google_connections_v2 WHERE status='connected'",
        )
        .get() as { n: number }
    ).n;
    const eventCount = (
      db
        .prepare(
          "SELECT count(*) n FROM academic_events_v3 WHERE cancelled_at IS NULL AND ends_at>?",
        )
        .get(Date.now()) as { n: number }
    ).n;
    const english = getUiLanguage() === "en";
    const tr = (pt: string, en: string) => (english ? en : pt);
    const guides = institutions
      .filter((i) => !i.archivedAt)
      .map((i) => ({
        id: i.id,
        content: GettingStarted({ db, institutionId: i.id }),
      }))
      .filter((i) => i.content !== null);
    return (
      <ConsoleShell
        title={tr("Painel administrativo", "Admin dashboard")}
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
        {guides.length === 1 ? (
          guides[0].content
        ) : guides.length > 1 ? (
          <details className="admin-pending-guide">
            <summary>Continuar a configuração das instituições</summary>
            {guides.map((i) => (
              <div key={i.id}>{i.content}</div>
            ))}
          </details>
        ) : null}
        <section aria-labelledby="control-institutions-title">
          <div className="admin-section-header">
            <h2 id="control-institutions-title">
              {tr("Instituições", "Institutions")}
            </h2>
            <Link href="/control/institutions">
              {tr("Ver todas", "View all")} →
            </Link>
          </div>
          <div className="admin-portal-grid">
            {institutions.map((item) => (
              <Link
                key={item.id}
                href={`/control/institutions/${item.id}`}
                className="admin-portal-card"
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
        <section
          className="admin-service-grid"
          aria-label={tr("Gestão da instância", "Instance management")}
        >
          <article>
            <small>{tr("PESSOAS", "PEOPLE")}</small>
            <h2>
              {tr(
                "Contas e responsabilidades",
                "Accounts and responsibilities",
              )}
            </h2>
            <p>
              {users} {tr("contas ativas", "active accounts")} · {grantCount}{" "}
              {tr("concessões ativas", "active grants")}
            </p>
            <Link href="/control/users">
              {tr("Abrir usuários", "Open users")} →
            </Link>
            <details>
              <summary>
                {tr("Permissões delegadas", "Delegated permissions")}
              </summary>
              <p>
                {tr(
                  "Gestores atuam somente no escopo concedido. Acesso a conteúdo privado não é concedido por ser gestor.",
                  "Managers act only within granted scopes. Management does not grant access to private content.",
                )}
              </p>
              <Link href="/control/grants">
                {tr("Gerenciar responsabilidades", "Manage responsibilities")} →
              </Link>
            </details>
          </article>
          <article>
            <small>{tr("INTEGRAÇÕES", "INTEGRATIONS")}</small>
            <h2>Google / Classroom / Drive</h2>
            <p>
              {connected}{" "}
              {tr("contas Google conectadas", "connected Google accounts")}
            </p>
            <Link href="/control/google">
              {tr("Abrir integrações", "Open integrations")} →
            </Link>
            <details>
              <summary>{tr("Como funciona", "How it works")}</summary>
              <p>
                {tr(
                  "Cada pessoa conecta o próprio Classroom. O destino dos arquivos da instância é configurado separadamente.",
                  "Each person connects their own Classroom. Instance file storage is configured separately.",
                )}
              </p>
            </details>
          </article>
          <article>
            <small>{tr("SISTEMA", "SYSTEM")}</small>
            <h2>{tr("Operação da instalação", "Installation operations")}</h2>
            <p>
              {eventCount}{" "}
              {tr("eventos/provas agendados", "scheduled events/exams")}
            </p>
            <Link href="/control/system">
              {tr("Abrir sistema", "Open system")} →
            </Link>
            <details>
              <summary>{tr("Recursos opcionais", "Optional features")}</summary>
              <Link href="/control/extras">
                {tr("Configurar Extras", "Configure Extras")} →
              </Link>
            </details>
          </article>
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
