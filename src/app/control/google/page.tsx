import { UiCopy } from "@/components/ui-language-provider";
import Link from "next/link";
import { redirect } from "next/navigation";
import { withV2DbAsync, currentAdminV2 } from "@/lib/v2/runtime";
import { storageOwnerCandidates } from "@/lib/v2/drive-storage";
import { googleOperationalStatus } from "@/lib/v2/google-diagnostics";
import { driveFolderCoverage } from "@/lib/v2/drive-folders";
import { googleAutomationStatus } from "@/lib/v2/google-automation";
import { getUiLanguage } from "@/lib/ui-language";
import { uiText } from "@/lib/translations";
import { ConsoleShell } from "../ui";
import {
  setStorageOwnerAction,
  repairDriveRootAction,
  provisionDriveFoldersAction,
  setGoogleAutomationAction,
} from "./actions";

export default async function GoogleOperations({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const q = await searchParams;
  const data = await withV2DbAsync(async (db) => {
    const admin = await currentAdminV2(db);
    if (!admin) return null;
    return {
      admin,
      status: googleOperationalStatus(db),
      automation: googleAutomationStatus(db),
      candidates: storageOwnerCandidates(db),
    };
  });
  if (!data) redirect("/control/login");
  const language = getUiLanguage();
  const tr = (pt: string, en: string) => uiText(language, pt, en);
  const { status, automation, candidates, admin } = data;
  const folders = driveFolderCoverage();
  return (
    <ConsoleShell
      title="Integrações"
      kicker="ADMINISTRAÇÃO / INTEGRAÇÕES"
      name={admin.name}
      admin
      active="integrations"
      message={q.ok}
      error={q.error}
    >
      <p>
        <Link href="/control">
          <UiCopy pt="Visão geral" en="Overview" />
        </Link>{" "}
        / {tr("Google e armazenamento", "Google and storage")}
      </p>
      <h2>
        <UiCopy pt="Configuração" en="Configuration" />
      </h2>
      <p>
        APP_URL: {status.config.appOrigin ?? tr("inválida", "invalid")} ·
        callback:{" "}
        {status.config.expectedRedirectUri ?? tr("indisponível", "unavailable")}
      </p>
      <p>
        {tr("Cliente Google", "Google client")}:{" "}
        {status.config.clientConfigured
          ? tr("configurado", "configured")
          : tr("pendente", "pending")}{" "}
        · {tr("chave de criptografia", "encryption key")}:{" "}
        {status.config.encryptionKeyConfigured
          ? tr("configurada", "configured")
          : tr("pendente", "pending")}
      </p>
      {status.config.errors.length > 0 && (
        <ul>
          {status.config.errors.map((error) => (
            <li key={error}>{error}</li>
          ))}
        </ul>
      )}
      <h2>Central Drive</h2>
      <p>
        Owner: {status.storage?.ownerName ?? tr("nenhum", "none")} ·{" "}
        {tr("conexão", "connection")}:{" "}
        {status.storage?.connected
          ? tr("pronta", "ready")
          : tr("indisponível", "unavailable")}{" "}
        · {tr("diretório", "directory")}:{" "}
        {status.storage?.rootReady
          ? tr("criado", "created")
          : tr("pendente", "pending")}
      </p>
      <p>
        {tr("Pastas das disciplinas registradas", "Registered subject folders")}
        : {folders.configured} {tr("de", "of")} {folders.total}
        {folders.configured === folders.total
          ? tr(" preparadas", " ready")
          : tr(" preparadas; faltam pastas", " ready; folders are missing")}
        .
      </p>
      {status.storage?.connected ? (
        <form action={provisionDriveFoldersAction}>
          <button type="submit">
            <UiCopy
              pt="Conferir e sincronizar pastas das disciplinas"
              en="Check and sync subject folders"
            />
          </button>
        </form>
      ) : null}
      <form action={setStorageOwnerAction} className="v2-fields">
        <label>
          <UiCopy
            pt="Usuário normal autorizado para Drive"
            en="User authorized for Drive"
          />
          <select
            name="ownerId"
            defaultValue={String(status.storage?.ownerId ?? "")}
          >
            <option value="">
              <UiCopy pt="Sem Drive central" en="No central Drive" />
            </option>
            {candidates.map((user) => (
              <option key={user.id} value={user.id}>
                {user.name}
              </option>
            ))}
          </select>
        </label>
        <button type="submit">
          <UiCopy pt="Salvar storage owner" en="Save storage owner" />
        </button>
      </form>
      <p>
        <UiCopy
          pt="Se houver objetos no Drive atual, a troca de owner exige migração antes de salvar."
          en="If the current Drive contains objects, changing its owner requires migration before saving."
        />
      </p>
      {status.storage?.connected && (
        <form action={repairDriveRootAction}>
          <button type="submit">
            <UiCopy
              pt="Reparar diretório Drive após verificar a referência"
              en="Repair Drive directory after checking its reference"
            />
          </button>
        </form>
      )}
      <h2>
        <UiCopy pt="Sincronização automática" en="Automatic sync" />
      </h2>
      <p>
        <UiCopy
          pt="Com a automação ativa e o servidor aberto, o Classroom atualiza e o Drive é verificado sem criar arquivos. Falhas aparecem aqui."
          en="With automation enabled and the server running, Classroom is updated and Drive is checked without creating files. Errors appear here."
        />
      </p>
      <form action={setGoogleAutomationAction} className="v2-fields">
        <label>
          <UiCopy pt="Intervalo" en="Interval" />
          <select
            name="intervalMinutes"
            defaultValue={automation.intervalMinutes}
          >
            <option value="0">
              <UiCopy pt="Desativada" en="Disabled" />
            </option>
            <option value="15">
              <UiCopy pt="A cada 15 minutos" en="Every 15 minutes" />
            </option>
            <option value="30">
              <UiCopy pt="A cada 30 minutos" en="Every 30 minutes" />
            </option>
            <option value="60">
              <UiCopy pt="A cada 1 hora" en="Every hour" />
            </option>
            <option value="120">
              <UiCopy pt="A cada 2 horas" en="Every 2 hours" />
            </option>
            <option value="360">
              <UiCopy pt="A cada 6 horas" en="Every 6 hours" />
            </option>
          </select>
        </label>
        <button type="submit">
          <UiCopy pt="Salvar intervalo" en="Save interval" />
        </button>
      </form>
      <p>
        {tr("Última execução", "Last run")}:{" "}
        {automation.lastFinishedAt
          ? new Date(automation.lastFinishedAt).toLocaleString(language)
          : tr("aguardando", "waiting")}{" "}
        · Drive:{" "}
        {
          {
            pending: tr("aguardando verificação", "waiting for check"),
            ready: tr("acessível", "available"),
            needs_reconnect: tr("reconectar Google", "reconnect Google"),
            permission_denied: tr("permissão negada", "permission denied"),
            missing: tr(
              "pasta ausente ou inacessível",
              "folder missing or inaccessible",
            ),
            error: tr("falha temporária", "temporary failure"),
          }[
            !status.storage?.ownerId
              ? "pending"
              : !status.storage.connected
                ? "needs_reconnect"
                : automation.driveStatus
          ]
        }
      </p>
      <h2>
        <UiCopy pt="Classroom por usuário" en="Classroom by user" />
      </h2>
      <table>
        <thead>
          <tr>
            <th>
              <UiCopy pt="Usuário" en="User" />
            </th>
            <th>Google</th>
            <th>Mappings</th>
            <th>Sync</th>
          </tr>
        </thead>
        <tbody>
          {status.users.map((user) => (
            <tr key={user.id}>
              <td>{user.name}</td>
              <td>
                {user.needsReconnect
                  ? tr("Reconectar", "Reconnect")
                  : user.connected
                    ? tr("Conectado", "Connected")
                    : tr("Não conectado", "Not connected")}
              </td>
              <td>
                {user.mapped}/{user.eligible}
              </td>
              <td>
                {user.syncProblems
                  ? tr("Precisa de ação", "Needs action")
                  : tr("Sem erro", "No errors")}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </ConsoleShell>
  );
}
