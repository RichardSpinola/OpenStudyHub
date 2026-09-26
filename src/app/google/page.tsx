import { UiCopy } from "@/components/ui-language-provider";
import Link from "next/link";
import { redirect } from "next/navigation";
import { withV2DbAsync, currentUserV2 } from "@/lib/v2/runtime";
import { googleConnectionStatus } from "@/lib/v2/google-oauth";
import { eligibleOfferings, suggestClassrooms } from "@/lib/v2/classroom";
import {
  connectGoogleV2Action,
  disconnectGoogleV2Action,
  discoverClassroomsAction,
  confirmClassroomsAction,
} from "./actions";
import { ClassroomSyncStatus } from "./sync-status";
import { SyncAllClassrooms } from "./sync-all";
import { getCurrentSession } from "@/lib/authorization";
import { getUserProfile } from "@/lib/profile";
import { storageOwnerStatus } from "@/lib/v2/drive-storage";
import { googleAutomationStatus } from "@/lib/v2/google-automation";
import { googleHealthStatus } from "@/lib/v2/google-health";
import { getUiLanguage } from "@/lib/ui-language";
import { uiText } from "@/lib/translations";

export default async function GoogleOnboarding({
  searchParams,
}: {
  searchParams: Promise<{
    ok?: string;
    error?: string;
    google?: string;
    step?: string;
  }>;
}) {
  const q = await searchParams;
  const data = await withV2DbAsync(async (db) => {
    const user = await currentUserV2(db);
    if (!user) return null;
    const connection = googleConnectionStatus(db, user.id);
    const courses = db
      .prepare(
        "SELECT course_id id,name,section FROM classroom_courses_v2 WHERE user_id=? ORDER BY name,course_id",
      )
      .all(user.id) as Array<{
      id: string;
      name: string;
      section: string | null;
    }>;
    const mappings = db
      .prepare(
        "SELECT offering_id offeringId,course_id courseId FROM user_classroom_mappings WHERE user_id=?",
      )
      .all(user.id) as Array<{ offeringId: number; courseId: string }>;
    const latestSync = db
      .prepare(
        "SELECT MAX(last_success_at) lastSyncAt FROM classroom_sync_v2 WHERE user_id=?",
      )
      .get(user.id) as { lastSyncAt: number | null };
    return {
      lastSyncAt: latestSync.lastSyncAt,
      user,
      connection,
      courses,
      mappings,
      suggestions: suggestClassrooms(db, user.id),
      offerings: eligibleOfferings(db, user.id),
      driveOwner: storageOwnerStatus(db),
      automation: googleAutomationStatus(db),
      health: googleHealthStatus(db, user.id),
    };
  });
  if (!data) redirect("/login");
  if (data.user.mustChangePassword) redirect("/gestao/password");
  const normalSession = await getCurrentSession();
  const language = normalSession
    ? getUserProfile(normalSession.user.id).locale
    : getUiLanguage();
  const tr = (pt: string, en: string) => uiText(language, pt, en);
  const onboardingIncomplete =
    normalSession &&
    getUserProfile(normalSession.user.id).onboardingVersion < 1;
  const connected = data.connection?.status === "connected";
  const requested = q.step;
  const step = !connected
    ? "connect"
    : requested === "discovery" ||
        requested === "mapping" ||
        requested === "sync" ||
        requested === "done"
      ? requested
      : q.google === "connected"
        ? "discovery"
        : data.mappings.length
          ? "summary"
          : data.courses.length
            ? "mapping"
            : "discovery";
  return (
    <div className="academic-shell google-journey">
      <header className="google-hero">
        <div>
          <span className="page-kicker">
            <UiCopy pt="INTEGRAÇÕES" en="INTEGRATIONS" />
          </span>
          <h1>Google</h1>
          <p>
            <UiCopy
              pt="Classroom e Drive no seu espaço de estudo."
              en="Classroom and Drive in your study space."
            />
          </p>
        </div>
        <strong
          data-state={
            data.health.connection === "needs_reconnect"
              ? "attention"
              : data.health.result === "temporary_error"
                ? "temporary"
                : connected
                  ? "connected"
                  : "offline"
          }
        >
          {data.health.connection === "needs_reconnect"
            ? tr("⚠ Precisa reconectar", "⚠ Needs reconnection")
            : data.health.result === "temporary_error"
              ? tr("○ Verificação indisponível", "○ Check unavailable")
              : connected
                ? tr("● Conectado", "● Connected")
                : tr("○ Não conectado", "○ Not connected")}
        </strong>
      </header>
      <section
        className="google-connection-overview"
        aria-label={tr(
          "Estado da integração Google",
          "Google integration status",
        )}
      >
        <div>
          <span>
            <UiCopy pt="CONTA" en="ACCOUNT" />
          </span>
          <strong>
            {connected
              ? tr("Conta Google conectada", "Google account connected")
              : data.health.connection === "needs_reconnect"
                ? tr("Autorização expirada", "Authorization expired")
                : tr("Nenhuma conta conectada", "No account connected")}
          </strong>
        </div>
        <div>
          <span>
            <UiCopy pt="ESTADO" en="STATUS" />
          </span>
          <strong>
            {data.health.result === "ready"
              ? tr("Acesso confirmado", "Access confirmed")
              : data.health.result === "temporary_error"
                ? tr(
                    "Google temporariamente indisponível",
                    "Google temporarily unavailable",
                  )
                : data.health.result === "needs_reconnect"
                  ? tr("Autorização revogada", "Authorization revoked")
                  : tr("Aguardando verificação", "Waiting for check")}
          </strong>
        </div>
        <div>
          <span>
            <UiCopy pt="ÚLTIMA VERIFICAÇÃO" en="LAST CHECK" />
          </span>
          <strong>
            {data.health.checkedAt
              ? new Intl.DateTimeFormat(language, {
                  dateStyle: "short",
                  timeStyle: "short",
                }).format(data.health.checkedAt)
              : tr("Ainda não realizada", "Not yet performed")}
          </strong>
        </div>
        {data.health.connection === "needs_reconnect" ? (
          <form action={connectGoogleV2Action}>
            <button type="submit">
              <UiCopy pt="Reconectar Google" en="Reconnect Google" />
            </button>
          </form>
        ) : null}
      </section>
      {q.ok || q.google === "connected" ? (
        <p className="form-success" role="status">
          {q.ok ??
            tr(
              "Google conectado. Busque seus Classrooms.",
              "Google connected. Find your Classrooms.",
            )}
        </p>
      ) : null}
      {q.error || q.google === "error" ? (
        <p className="form-error" role="alert">
          {q.error ??
            tr(
              "Não foi possível conectar. Tente novamente.",
              "Could not connect. Try again.",
            )}
        </p>
      ) : null}
      {step !== "summary" ? (
        <ol className="google-steps" aria-label={tr("Etapas da integração", "Integration steps")}>
          <li
            data-done={connected}
            aria-current={step === "connect" ? "step" : undefined}
          >
            1{" "}
            <span>
              <UiCopy pt="Conectar Google" en="Connect Google" />
            </span>
          </li>
          <li
            data-done={data.courses.length > 0}
            aria-current={step === "discovery" ? "step" : undefined}
          >
            2{" "}
            <span>
              <UiCopy pt="Encontrar Classrooms" en="Find Classrooms" />
            </span>
          </li>
          <li
            data-done={data.mappings.length > 0}
            aria-current={step === "mapping" ? "step" : undefined}
          >
            3{" "}
            <span>
              <UiCopy pt="Confirmar disciplinas" en="Confirm subjects" />
            </span>
          </li>
          <li
            data-done={connected && data.mappings.length > 0}
            aria-current={
              step === "sync" || step === "done" ? "step" : undefined
            }
          >
            4{" "}
            <span>
              <UiCopy pt="Pronto" en="Ready" />
            </span>
          </li>
        </ol>
      ) : null}
      {step === "summary" || step === "connect" || step === "done" ? (
        <section className="google-service-grid" aria-label={tr("Serviços Google", "Google services")}>
          <div className="google-service-card">
            <span className="page-kicker">CLASSROOM</span>
            <h2>
              <UiCopy pt="Suas disciplinas" en="Your subjects" />
            </h2>
            <strong>
              {data.mappings.length} de {data.offerings.length}
              <UiCopy pt="associadas" en="mapped" />
            </strong>
            <p>
              {data.lastSyncAt
                ? tr(`Atualizado em ${new Intl.DateTimeFormat(language, { dateStyle: "short", timeStyle: "short" }).format(data.lastSyncAt)}`, `Updated ${new Intl.DateTimeFormat(language, { dateStyle: "short", timeStyle: "short" }).format(data.lastSyncAt)}`)
                : tr("Ainda sem atualização sincronizada.", "No update has been synced yet.")}
            </p>
            {connected ? (
              <div className="google-summary-actions">
                <Link href="/google?step=mapping">
                  <UiCopy pt="Gerenciar associações" en="Manage mappings" />
                </Link>
                <Link href="/google?step=sync">
                  <UiCopy pt="Ver sincronização" en="View sync" />
                </Link>
                <SyncAllClassrooms
                  offeringIds={data.mappings.map(
                    (mapping) => mapping.offeringId,
                  )}
                />
              </div>
            ) : null}
          </div>
          <div className="google-service-card">
            <span className="page-kicker">DRIVE</span>
            <h2>
              <UiCopy pt="Arquivos da instância" en="Instance files" />
            </h2>
            <strong>
              {data.driveOwner?.ownerId === data.user.id
                ? !connected || !data.driveOwner.connected
                  ? tr("Reconexão necessária", "Reconnection required")
                  : data.automation.driveStatus === "ready"
                    ? tr("Acessível", "Accessible")
                    : data.automation.driveStatus === "permission_denied"
                      ? tr("Permissão negada", "Permission denied")
                      : data.automation.driveStatus === "missing"
                        ? tr("Pasta não encontrada", "Folder not found")
                        : data.automation.driveStatus === "error"
                          ? tr("Falha de acesso", "Access failure")
                          : tr("Aguardando verificação", "Waiting for check")
                : tr("Gerenciado pelo administrador", "Managed by Admin")}
            </strong>
            <p>
              {data.driveOwner?.ownerId === data.user.id
                ? tr("Esta conta guarda os arquivos centrais.", "This account stores central files.")
                : tr("O armazenamento é configurado pelo responsável da instância.", "Storage is configured by the instance owner.")}
            </p>
            {connected &&
            step === "summary" &&
            data.driveOwner?.ownerId === data.user.id ? (
              <a href="#google-drive-options">
                <UiCopy
                  pt="Revisar autorização do Drive ↓"
                  en="Review Drive authorization ↓"
                />
              </a>
            ) : null}
          </div>
          {step === "connect" ? (
            <form action={connectGoogleV2Action}>
              <button type="submit">
                {data.connection ? "Reconectar Google" : "Conectar Google"}
              </button>
            </form>
          ) : (
            <form
              action={disconnectGoogleV2Action}
              className="google-disconnect"
            >
              <button type="submit" className="secondary-button">
                <UiCopy pt="Desconectar Google" en="Disconnect Google" />
              </button>
            </form>
          )}
        </section>
      ) : null}
      {connected ? (
        <>
          {step === "discovery" ? (
            <section
              className="workflow-panel"
              aria-labelledby="google-discovery-title"
            >
              <div className="section-heading">
                <h2 id="google-discovery-title">
                  <UiCopy
                    pt="Encontrar seus Classrooms"
                    en="Find your Classrooms"
                  />
                </h2>
              </div>
              <p>
                <UiCopy
                  pt="Busque as turmas da sua conta Google. A busca não confirma nenhuma associação automaticamente."
                  en="Find courses in your Google account. Search does not confirm any mapping automatically."
                />
              </p>
              <form action={discoverClassroomsAction}>
                <button type="submit">
                  {data.courses.length
                    ? "Atualizar lista de Classrooms"
                    : "Buscar meus Classrooms"}
                </button>
              </form>
              {data.courses.length ? (
                <p>
                  <Link href="/google?step=mapping">
                    <UiCopy
                      pt="Continuar para associações →"
                      en="Continue to mappings →"
                    />
                  </Link>
                </p>
              ) : null}
            </section>
          ) : null}
          {step === "mapping" ? (
            <section
              className="workflow-panel"
              id="google-mappings"
              aria-labelledby="google-mappings-title"
            >
              <div className="section-heading">
                <h2 id="google-mappings-title">
                  <UiCopy pt="Confirmar disciplinas" en="Confirm subjects" />
                </h2>
                <span>
                  {data.mappings.length}/{data.offerings.length}
                </span>
              </div>
              <p>
                <UiCopy
                  pt="Confira cada par. Sugestões ficam selecionadas para revisão, mas só são salvas quando você confirmar."
                  en="Check each pair. Suggestions are selected for review but are saved only when you confirm."
                />
              </p>
              {data.courses.length === 0 ? (
                <p>
                  <Link href="/google?step=discovery">
                    <UiCopy
                      pt="Busque seus Classrooms para iniciar →"
                      en="Find your Classrooms to start →"
                    />
                  </Link>
                </p>
              ) : (
                <form
                  action={confirmClassroomsAction}
                  className="google-mapping-form"
                >
                  {data.suggestions.map((item) => {
                    const current = data.mappings.find(
                      (mapping) => mapping.offeringId === item.offeringId,
                    )?.courseId;
                    return (
                      <div className="google-mapping-row" key={item.offeringId}>
                        <div>
                          <span className="page-kicker">OPENSTUDYHUB</span>
                          <strong>{item.subjectName}</strong>
                          <small>{item.subjectCode}</small>
                        </div>
                        <span
                          aria-hidden="true"
                          className="google-mapping-arrow"
                        >
                          ↔
                        </span>
                        <label>
                          <span className="page-kicker">GOOGLE CLASSROOM</span>
                          <select
                            name={`mapping-${item.offeringId}`}
                            defaultValue={
                              current ??
                              (item.ambiguous
                                ? ""
                                : item.suggestion?.courseId) ??
                              ""
                            }
                          >
                            <option value="">
                              <UiCopy
                                pt="Não associar / desassociar"
                                en="Do not map / unlink"
                              />
                            </option>
                            {data.courses.map((course) => (
                              <option key={course.id} value={course.id}>
                                {course.name}
                                {course.section ? ` · ${course.section}` : ""}
                              </option>
                            ))}
                          </select>
                          {item.ambiguous ? (
                            <small className="google-ambiguity">
                              <UiCopy
                                pt="Há Classrooms parecidos. Escolha manualmente."
                                en="There are similar Classrooms. Choose manually."
                              />
                            </small>
                          ) : item.suggestion && !current ? (
                            <small>
                              <UiCopy
                                pt="Sugestão selecionada para sua revisão."
                                en="Suggestion selected for your review."
                              />
                            </small>
                          ) : current ? (
                            <small>
                              <UiCopy
                                pt="Associação confirmada. Você pode trocar ou remover."
                                en="Mapping confirmed. You can change or remove it."
                              />
                            </small>
                          ) : null}
                        </label>
                      </div>
                    );
                  })}
                  <button type="submit">
                    <UiCopy pt="Confirmar associações" en="Confirm mappings" />
                  </button>
                </form>
              )}
              <p>
                <Link href="/google?step=discovery">
                  <UiCopy pt="Voltar à descoberta" en="Back to discovery" />
                </Link>
              </p>
            </section>
          ) : null}
          {step === "sync" ? (
            <section
              className="workflow-panel"
              id="google-sync"
              aria-labelledby="google-sync-title"
            >
              <div className="section-heading">
                <h2 id="google-sync-title">
                  <UiCopy
                    pt="Atualizações das disciplinas"
                    en="Subject updates"
                  />
                </h2>
              </div>
              {data.mappings.length === 0 ? (
                <p>
                  <UiCopy
                    pt="Confirme ao menos uma associação para sincronizar."
                    en="Confirm at least one mapping to sync."
                  />
                </p>
              ) : (
                data.mappings.map((mapping) => {
                  const offering = data.offerings.find(
                    (item) => item.offeringId === mapping.offeringId,
                  );
                  return offering ? (
                    <ClassroomSyncStatus
                      key={mapping.offeringId}
                      offeringId={mapping.offeringId}
                      label={offering.subjectName}
                    />
                  ) : null;
                })
              )}
              <p>
                <Link href="/google">
                  <UiCopy pt="Voltar ao resumo" en="Back to overview" />
                </Link>
              </p>
            </section>
          ) : null}
        </>
      ) : null}
      {connected && step === "summary" ? (
        <details
          id="google-drive-options"
          className="workflow-panel google-extra"
        >
          <summary>
            <UiCopy
              pt="Usar Drive para guardar arquivos da instância"
              en="Use Drive to store instance files"
            />
          </summary>
          <p>
            <UiCopy
              pt="Esta autorização adicional só é necessária para quem for escolhido como responsável pelo armazenamento da instância."
              en="This additional authorization is needed only by the person chosen to manage instance storage."
            />
          </p>
          <form action={connectGoogleV2Action}>
            <input type="hidden" name="drive" value="1" />
            <button type="submit">
              <UiCopy pt="Autorizar Drive" en="Authorize Drive" />
            </button>
          </form>
        </details>
      ) : null}
      <Link
        href={onboardingIncomplete ? "/onboarding" : "/settings?section=google"}
      >
        {onboardingIncomplete
          ? tr("← Voltar aos primeiros passos", "← Back to getting started")
          : tr("← Voltar para Configurações", "← Back to Settings")}
      </Link>
    </div>
  );
}
