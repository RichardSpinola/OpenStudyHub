"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  IconKey,
  IconClock,
  IconShieldCheck,
  IconDownload,
} from "@tabler/icons-react";
import {
  configureBackupAction,
  encryptedBackupAction,
} from "@/app/control/system/backup-actions";
import type { BackupConfig, BackupRun } from "@/lib/v2/backup-service";
import { useUiText } from "./ui-language-provider";
export function BackupCenter({
  config,
  configured,
  runs,
  driveReady,
  workerActive,
}: {
  config: BackupConfig;
  configured: boolean;
  runs: BackupRun[];
  driveReady: boolean;
  workerActive: boolean;
}) {
  const tr = useUiText(),
    router = useRouter();
  const [value, setValue] = useState(config),
    [key, setKey] = useState(""),
    [confirmed, setConfirmed] = useState(false),
    [status, setStatus] = useState(""),
    [pending, start] = useTransition();
  const generate = () => {
    const bytes = crypto.getRandomValues(new Uint8Array(32));
    setKey(
      btoa(String.fromCharCode(...bytes))
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/, ""),
    );
    setConfirmed(false);
  };
  const downloadKey = () => {
    const url = URL.createObjectURL(
      new Blob(
        [
          `OpenStudyHub recovery key\n${key}\nKeep this file separate from your backups.\n`,
        ],
        { type: "text/plain" },
      ),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = "openstudyhub-recovery-key.txt";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  return (
    <div className="backup-center">
      <header>
        <IconShieldCheck aria-hidden="true" size={30} />
        <div>
          <h2>{tr("Cópias de segurança", "Backups")}</h2>
          <p>
            {tr(
              "Bancos e arquivos locais protegidos por uma chave de recuperação.",
              "Databases and local files protected with a recovery key.",
            )}
          </p>
        </div>
      </header>
      <p>
        {tr(
          "Inclui notas, imagens, anexos e versões locais. Arquivos que existem apenas no Google Drive e outros sites não são baixados para o pacote. Após restaurar, reconecte Google e notificações.",
          "Includes notes, images, attachments and local versions. Files that exist only in Google Drive or other sites are not downloaded into the package. Reconnect Google and notifications after restoring.",
        )}
      </p>
      <form
        className="stack-form"
        onSubmit={(e) => {
          e.preventDefault();
          start(async () => {
            const result = await configureBackupAction({
              ...value,
              key: key || undefined,
              confirmed,
            });
            setStatus(
              result.error ?? tr("Configuração salva.", "Settings saved."),
            );
            if (result.ok) {
              setKey("");
              router.refresh();
            }
          });
        }}
      >
        {!configured ? (
          <fieldset>
            <legend>
              <IconKey size={18} aria-hidden="true" />{" "}
              {tr("1. Guarde sua chave", "1. Save your key")}
            </legend>
            <p>
              {tr(
                "Sem esta chave, o backup não pode ser aberto. Guarde-a fora deste servidor e separada das cópias.",
                "Without this key, the backup cannot be opened. Store it outside this server and separately from the copies.",
              )}
            </p>
            <button type="button" onClick={generate}>
              {tr("Gerar chave de recuperação", "Generate recovery key")}
            </button>
            {key ? (
              <>
                <code className="recovery-key">{key}</code>
                <button type="button" onClick={downloadKey}>
                  <IconDownload size={17} />
                  {tr("Baixar minha chave", "Download my key")}
                </button>
                <label>
                  <input
                    type="checkbox"
                    checked={confirmed}
                    onChange={(e) => setConfirmed(e.target.checked)}
                  />
                  {tr(
                    "Guardei a chave em um local seguro.",
                    "I saved the key in a safe place.",
                  )}
                </label>
              </>
            ) : null}
          </fieldset>
        ) : (
          <p className="admin-status-line">
            <IconKey size={18} />
            {tr(
              "Chave configurada. As cópias novas usam a mesma chave.",
              "Key configured. New copies use the same key.",
            )}
          </p>
        )}
        <fieldset>
          <legend>
            {tr("2. Destino e rotina", "2. Destination and schedule")}
          </legend>
          <label>
            {tr("Guardar cópias", "Store copies")}
            <select
              value={value.destination}
              onChange={(e) =>
                setValue({
                  ...value,
                  destination: e.target.value as BackupConfig["destination"],
                })
              }
            >
              <option value="local">
                {tr("Neste servidor", "On this server")}
              </option>
              <option value="local-drive" disabled={!driveReady}>
                {tr(
                  "Neste servidor e no Drive central",
                  "On this server and in central Drive",
                )}
              </option>
            </select>
          </label>
          {!driveReady ? (
            <p>
              {tr(
                "Para adicionar o Drive, conecte a conta responsável e configure a pasta em Integrações.",
                "To add Drive, connect the responsible account and configure the folder under Integrations.",
              )}
            </p>
          ) : null}
          <label>
            <input
              type="checkbox"
              checked={value.enabled}
              onChange={(e) =>
                setValue({ ...value, enabled: e.target.checked })
              }
            />
            {tr(
              "Criar backup automaticamente todos os dias",
              "Create an automatic backup every day",
            )}
          </label>
          <div className="backup-schedule-fields">
            <label>
              {tr("Horário", "Time")}
              <input
                type="time"
                value={value.time}
                required
                onChange={(e) => setValue({ ...value, time: e.target.value })}
              />
            </label>
            <label>
              {tr("Fuso horário", "Time zone")}
              <input
                value={value.timeZone}
                required
                maxLength={80}
                placeholder="America/Bahia"
                onChange={(e) =>
                  setValue({ ...value, timeZone: e.target.value })
                }
              />
            </label>
            <label>
              {tr("Cópias automáticas a manter", "Automatic copies to keep")}
              <input
                type="number"
                min={1}
                max={90}
                required
                value={value.retention}
                onChange={(e) =>
                  setValue({ ...value, retention: Number(e.target.value) })
                }
              />
            </label>
          </div>
          <p>
            {tr(
              "Sugestão: 03:00 e 7 cópias válidas. Cópias manuais não são removidas por esta rotina. Se o servidor estiver desligado no horário, a rotina tenta ao voltar no mesmo dia.",
              "Suggested: 03:00 and 7 valid copies. Manual copies are not removed by this routine. If the server is off at the scheduled time, the routine tries when it returns that day.",
            )}
          </p>
        </fieldset>
        <button disabled={pending || (!configured && (!key || !confirmed))}>
          {pending
            ? tr("Aguarde…", "Please wait…")
            : tr("Salvar rotina de backup", "Save backup schedule")}
        </button>
      </form>
      <div className="backup-manual-action">
        <button
          type="button"
          disabled={pending || !configured}
          onClick={() =>
            start(async () => {
              setStatus(
                tr(
                  "Criando cópia. A edição ficará pausada brevemente enquanto os dados são copiados.",
                  "Creating backup. Editing will pause briefly while data is copied.",
                ),
              );
              const result = await encryptedBackupAction();
              setStatus(
                result.message ??
                  (result.ok
                    ? tr(
                        "Backup protegido concluído.",
                        "Protected backup complete.",
                      )
                    : tr(
                        "Não foi possível criar a cópia.",
                        "Could not create the backup.",
                      )),
              );
              router.refresh();
            })
          }
        >
          {tr("Criar backup agora", "Create backup now")}
        </button>
        <p role="status" aria-live="polite">
          {status}
        </p>
      </div>
      {config.enabled ? (
        <p className="admin-status-line">
          <IconClock size={18} />
          {workerActive
            ? tr(
                "Rotina ativa; verificação recente.",
                "Worker active; recently checked.",
              )
            : tr(
                "Rotina sem sinal recente. Inicie o serviço realtime ou o worker de backup.",
                "No recent worker signal. Start the realtime service or backup worker.",
              )}
        </p>
      ) : null}
      <section>
        <h3>{tr("Últimas cópias", "Recent copies")}</h3>
        {runs.length ? (
          <ul className="backup-run-list">
            {runs.slice(0, 12).map((run) => (
              <li key={run.id}>
                <div>
                  <strong>{new Date(run.createdAt).toLocaleString()}</strong>
                  <span>
                    {run.kind === "manual"
                      ? tr("Manual", "Manual")
                      : tr("Automático", "Automatic")}{" "}
                    ·{" "}
                    {run.status === "complete"
                      ? tr("Concluído", "Complete")
                      : run.status === "local-only"
                        ? tr("Somente cópia local", "Local copy only")
                        : tr("Falhou", "Failed")}
                  </span>
                  {run.message ? <p>{run.message}</p> : null}
                </div>
                {run.status !== "error" ? (
                  <a
                    className="button-link"
                    href={`/control/system/backup/${run.id}`}
                  >
                    {tr("Baixar cópia protegida", "Download protected copy")}
                  </a>
                ) : null}
              </li>
            ))}
          </ul>
        ) : (
          <p>
            {tr(
              "Nenhuma cópia protegida criada ainda.",
              "No protected copy has been created yet.",
            )}
          </p>
        )}
      </section>
      <details>
        <summary>{tr("Como restaurar", "How to restore")}</summary>
        <ol>
          <li>
            {tr(
              "Baixe o backup e tenha sua chave em mãos.",
              "Download the backup and have your key ready.",
            )}
          </li>
          <li>
            {tr(
              "Use a ferramenta de validação em uma pasta de teste antes de substituir dados.",
              "Use the validation tool in a test folder before replacing data.",
            )}
          </li>
          <li>
            {tr(
              "Pare App, Admin, realtime e o worker de backup. Execute a restauração local com confirmação.",
              "Stop App, Admin, realtime and the backup worker. Run the local restore with confirmation.",
            )}
          </li>
          <li>
            {tr(
              "A ferramenta mantém uma cópia anterior para recuperação. Configure o ambiente e reconecte integrações ao iniciar.",
              "The tool keeps a previous copy for recovery. Configure the environment and reconnect integrations on startup.",
            )}
          </li>
        </ol>
        <p>
          <code>docs/operations/manual-backup-restore.md</code>
        </p>
      </details>
    </div>
  );
}
