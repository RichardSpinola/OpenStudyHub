import {
  databaseIntegrity,
  operationalHealth,
} from "@/lib/v2/operational-health";
import { PushSetup } from "@/components/push-setup";
import { pushConfiguration } from "@/lib/v2/push";
import { BackupCenter } from "@/components/backup-center";
import {
  backupConfig,
  backupRuns,
  hasRecoveryKey,
} from "@/lib/v2/backup-service";
import { storageOwnerStatus } from "@/lib/v2/drive-storage";
import { AdminSettingsTabs } from "../settings-tabs";
import { AdminActionPanel } from "../admin-action-panel";
import Link from "next/link";
import { ShortcutIconPicker } from "@/components/shortcut-icon-picker";
import { UiCopy } from "@/components/ui-language-provider";
import { redirect } from "next/navigation";
import { currentAdminV2, withV2DbAsync } from "@/lib/v2/runtime";
import { ConsoleShell } from "../ui";
import { getInstitutionName } from "@/lib/institution";
import { listExternalLinks } from "@/lib/external-links";
import {
  saveAutocompleteAction,
  saveInstitutionalLinkAction,
  removeInstitutionalLinkAction,
  saveInstitutionDisplayAction,
  saveBrandDisplayAction,
  moveInstitutionalLinkAction,
  setBundledStarterAction,
  createManualBackupAction,
  publishLinkAsShortcutAction,
  saveDefaultShortcutAction,
  removeDefaultShortcutAction,
  setInstanceLanguageAction,
} from "./actions";
import { getUiLanguage } from "@/lib/ui-language";
import { uiText } from "@/lib/translations";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
import { figletFontOptions, getBrandConfig } from "@/lib/home-settings";
import { getAutocompletePolicy } from "@/lib/search-suggestions";
import { getServerEnvironment } from "@/lib/env";
import { googleOperationalStatus } from "@/lib/v2/google-diagnostics";
import { listBundledStarterTemplates } from "@/lib/starter-document-templates";
import { backupDirectory } from "@/lib/v2/manual-backup";
import { existsSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { accessSync, constants } from "node:fs";
import { dirname } from "node:path";
import { getDatabase } from "@/lib/db/client";
import { listShortcuts } from "@/lib/shortcuts";
import packageManifest from "../../../../package.json";

function storageState(
  path: string,
  language: ReturnType<typeof getUiLanguage>,
): string {
  if (!path) return uiText(language, "não configurado", "not configured");
  try {
    const folder = existsSync(path) ? path : dirname(path);
    accessSync(folder, constants.R_OK | constants.W_OK);
    return uiText(language, "disponível", "available");
  } catch {
    return uiText(language, "indisponível", "unavailable");
  }
}

export default async function SystemPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; backup?: string }>;
}) {
  const { status, backup } = await searchParams;
  return withV2DbAsync(async (db) => {
    const language = getUiLanguage();
    const tr = (pt: string, en: string) => uiText(language, pt, en);
    const actor = await currentAdminV2(db);
    if (!actor) redirect("/control/login");
    if (actor.mustChangePassword) redirect("/control/password");
    const check = databaseIntegrity(db),
      integrity = check.healthy,
      foreignKeys = check.foreignKeys;
    const legacy = getDatabase().sqlite;
    const legacyCheck = databaseIntegrity(legacy),
      legacyIntegrity = legacyCheck.healthy,
      legacyForeignKeys = legacyCheck.foreignKeys;
    const operational = await operationalHealth();
    const legacyMigrationLog = legacy
      .prepare(
        "SELECT 1 FROM sqlite_master WHERE type='table' AND name='__drizzle_migrations'",
      )
      .get();
    const legacyMigrations = legacyMigrationLog
      ? (
          legacy
            .prepare("SELECT count(*) count FROM __drizzle_migrations")
            .get() as { count: number }
        ).count
      : null;
    const migrations = (
      db.prepare("SELECT count(*) count FROM v2_migration_log").get() as {
        count: number;
      }
    ).count;
    const google = googleOperationalStatus(db);
    const environment = getServerEnvironment();
    const autocomplete = getAutocompletePolicy();
    const links = listExternalLinks();
    const defaultShortcuts = listShortcuts();
    const brand = getBrandConfig();
    const starters = listBundledStarterTemplates();
    const backupRoot = backupDirectory();
    const backups = existsSync(backupRoot)
      ? readdirSync(backupRoot)
          .filter((name) => /^[0-9a-f-]{36}\.zip$/.test(name))
          .map((name) => ({
            id: name.slice(0, -4),
            date: statSync(join(backupRoot, name)).mtime.toISOString(),
          }))
          .sort((a, b) => b.date.localeCompare(a.date))
          .slice(0, 5)
      : [];
    return (
      <ConsoleShell
        title="Sistema"
        kicker="ADMINISTRAÇÃO / SISTEMA"
        name={actor.name}
        admin
        active="system"
        message={
          status && !status.endsWith("error")
            ? tr("Alteração salva.", "Changes saved.")
            : undefined
        }
        error={
          status === "backup-error"
            ? tr(
                "Backup não foi criado. Verifique os bancos e o espaço disponível.",
                "Backup could not be created. Check the databases and free space.",
              )
            : status?.endsWith("error")
              ? tr(
                  "Confira os dados informados.",
                  "Check the entered information.",
                )
              : undefined
        }
      >
        <p className="admin-page-description">
          {tr(
            "Configuração da instância, recursos disponíveis e manutenção.",
            "Instance configuration, available features and maintenance.",
          )}
        </p>
        <AdminSettingsTabs
          items={[
            {
              id: "appearance",
              label: tr("Aparência e identidade", "Appearance and identity"),
              content: (
                <>
                  <section className="admin-system-links">
                    <h2>
                      <UiCopy
                        pt="Identidade e links institucionais"
                        en="Institution identity and links"
                      />
                    </h2>
                    <form action={saveInstitutionDisplayAction}>
                      <label>
                        <UiCopy
                          pt="Nome exibido no aplicativo"
                          en="Name shown in the App"
                        />{" "}
                        <input
                          name="name"
                          maxLength={160}
                          defaultValue={getInstitutionName()}
                          placeholder={tr("Instituição", "Institution")}
                        />
                      </label>
                      <button type="submit">
                        <UiCopy pt="Salvar nome" en="Save name" />
                      </button>
                    </form>
                    <form action={saveBrandDisplayAction}>
                      <label>
                        <UiCopy pt="Texto da marca" en="Brand text" />{" "}
                        <input
                          name="brandText"
                          maxLength={20}
                          defaultValue={brand.text}
                          required
                        />
                      </label>
                      <label>
                        <UiCopy pt="Estilo da marca" en="Brand style" />
                        <select name="brandFont" defaultValue={brand.font}>
                          {figletFontOptions.map((font) => (
                            <option key={font} value={font}>
                              {font}
                            </option>
                          ))}
                        </select>
                      </label>
                      <button type="submit">
                        <UiCopy pt="Salvar marca" en="Save branding" />
                      </button>
                    </form>
                    <p>
                      <UiCopy
                        pt="Estes links aparecem para usuários no aplicativo. Atalhos pessoais da Home são separados."
                        en="These links appear for users in the App. Personal Home shortcuts are separate."
                      />
                    </p>
                    <ul>
                      {links.map((link, index) => (
                        <li key={link.id}>
                          <span>
                            {link.label} · {new URL(link.url).hostname}
                          </span>
                          <form action={moveInstitutionalLinkAction}>
                            <input type="hidden" name="id" value={link.id} />
                            <button
                              type="submit"
                              name="direction"
                              value="up"
                              disabled={index === 0}
                              aria-label={tr(
                                `Mover ${link.label} para cima`,
                                `Move ${link.label} up`,
                              )}
                            >
                              ↑
                            </button>
                            <button
                              type="submit"
                              name="direction"
                              value="down"
                              disabled={index === links.length - 1}
                              aria-label={tr(
                                `Mover ${link.label} para baixo`,
                                `Move ${link.label} down`,
                              )}
                            >
                              ↓
                            </button>
                          </form>
                          <form action={removeInstitutionalLinkAction}>
                            <input type="hidden" name="id" value={link.id} />
                            <ConfirmSubmitButton
                              confirmation={tr(
                                `Remover o link ${link.label}?`,
                                `Remove the link ${link.label}?`,
                              )}
                            >
                              <UiCopy pt="Remover" en="Remove" />
                            </ConfirmSubmitButton>
                          </form>
                          {!defaultShortcuts.some(
                            (shortcut) => shortcut.url === link.url,
                          ) ? (
                            <form action={publishLinkAsShortcutAction}>
                              <input type="hidden" name="id" value={link.id} />
                              <button type="submit">
                                <UiCopy
                                  pt="Adicionar à Home como padrão"
                                  en="Add to Home by default"
                                />
                              </button>
                            </form>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                    <form action={saveInstitutionalLinkAction}>
                      <label>
                        <UiCopy pt="Nome do link" en="Link name" />{" "}
                        <input name="label" required maxLength={80} />
                      </label>
                      <label>
                        URL HTTPS{" "}
                        <input
                          name="url"
                          required
                          type="url"
                          maxLength={2048}
                          placeholder="https://"
                        />
                      </label>
                      <label>
                        <input
                          type="checkbox"
                          name="alsoShortcut"
                          defaultChecked
                        />
                        <UiCopy
                          pt="Também adicionar como atalho padrão da Home"
                          en="Also add as a default Home shortcut"
                        />
                      </label>
                      <button type="submit">
                        <UiCopy pt="Adicionar link" en="Add link" />
                      </button>
                    </form>
                  </section>
                </>
              ),
            },
            {
              id: "shortcuts",
              label: tr("Atalhos", "Shortcuts"),
              content: (
                <>
                  <section className="admin-system-links">
                    <h2>
                      <UiCopy
                        pt="Atalhos padrão da Home"
                        en="Default Home shortcuts"
                      />
                    </h2>
                    <p>
                      <UiCopy
                        pt="Google Drive, Google Classroom, Gmail e GitHub já aparecem na Home de novas contas. Os atalhos adicionais abaixo também são recebidos no primeiro acesso. Cada pessoa pode personalizar a própria Home."
                        en="Google Drive, Google Classroom, Gmail and GitHub already appear on Home for new accounts. The additional shortcuts below also appear at first access. Everyone can customize their own Home."
                      />
                    </p>
                    <ul>
                      {defaultShortcuts.map((shortcut) => (
                        <li key={shortcut.id}>
                          <span>
                            {shortcut.name} · {new URL(shortcut.url).hostname}
                          </span>
                          <AdminActionPanel
                            title={
                              tr(
                                "Editar ícone e atalho",
                                "Edit icon and shortcut",
                              ) +
                              " " +
                              shortcut.name
                            }
                          >
                            <form action={saveDefaultShortcutAction}>
                              <input
                                type="hidden"
                                name="id"
                                value={shortcut.id}
                              />
                              <label>
                                {tr("Nome", "Name")}
                                <input
                                  name="name"
                                  defaultValue={shortcut.name}
                                  required
                                  maxLength={80}
                                />
                              </label>
                              <label>
                                URL
                                <input
                                  name="url"
                                  type="url"
                                  defaultValue={shortcut.url}
                                  required
                                />
                              </label>
                              <ShortcutIconPicker initial={shortcut.icon} />
                              <button>
                                {tr("Salvar atalho", "Save shortcut")}
                              </button>
                            </form>
                          </AdminActionPanel>
                          <form action={removeDefaultShortcutAction}>
                            <input
                              type="hidden"
                              name="id"
                              value={shortcut.id}
                            />
                            <ConfirmSubmitButton
                              confirmation={tr(
                                `Remover ${shortcut.name} dos atalhos padrão?`,
                                `Remove ${shortcut.name} from default shortcuts?`,
                              )}
                            >
                              <UiCopy pt="Remover padrão" en="Remove default" />
                            </ConfirmSubmitButton>
                          </form>
                        </li>
                      ))}
                    </ul>
                    <form action={saveDefaultShortcutAction}>
                      <label>
                        <UiCopy pt="Nome" en="Name" />
                        <input name="name" required maxLength={80} />
                      </label>
                      <label>
                        URL{" "}
                        <input
                          name="url"
                          type="url"
                          required
                          maxLength={2048}
                          placeholder="https://"
                        />
                      </label>
                      <ShortcutIconPicker />
                      <button type="submit">
                        <UiCopy
                          pt="Adicionar atalho padrão"
                          en="Add default shortcut"
                        />
                      </button>
                    </form>
                  </section>
                </>
              ),
            },
            {
              id: "resources",
              label: tr("Recursos e modelos", "Features and templates"),
              content: (
                <>
                  <div className="admin-context-links">
                    <Link href="/control/extras">
                      {tr("Configurar Extras", "Configure Extras")} →
                    </Link>
                  </div>
                  <section className="admin-system-links">
                    <h2>
                      <UiCopy pt="Modelos iniciais" en="Starter templates" />
                    </h2>
                    <p>
                      <UiCopy
                        pt="Estes três DOCX acompanham a instalação. Ativar um modelo permite ao usuário escolher título e disciplina antes de criar uma cópia DOCX privada; não exige ID do Google Drive."
                        en="These three DOCX files come with the installation. Enabling a template lets users choose a title and subject before creating a private DOCX copy; no Google Drive ID is needed."
                      />
                    </p>
                    <ul>
                      {starters.map((starter) => (
                        <li key={starter.key}>
                          <span>
                            {starter.name} ·{" "}
                            {starter.enabled
                              ? tr("ativo", "enabled")
                              : tr("desativado", "disabled")}
                          </span>
                          <form action={setBundledStarterAction}>
                            <input
                              type="hidden"
                              name="starterKey"
                              value={starter.key}
                            />
                            <button
                              type="submit"
                              name="enabled"
                              value={starter.enabled ? "false" : "true"}
                            >
                              {starter.enabled
                                ? tr("Desativar", "Disable")
                                : tr("Ativar", "Enable")}
                            </button>
                          </form>
                        </li>
                      ))}
                    </ul>
                  </section>
                  <p>
                    <UiCopy
                      pt="Atualizações continuam manuais. Faça backup antes de migrations e siga a documentação da instalação."
                      en="Updates remain manual. Back up before migrations and follow the installation guide."
                    />
                  </p>
                </>
              ),
            },
            {
              id: "search",
              label: tr("Busca", "Search"),
              content: (
                <>
                  <section
                    className="v3-autocomplete-policy"
                    aria-labelledby="home-autocomplete-title"
                  >
                    <h2 id="home-autocomplete-title">
                      {tr(
                        "Sugestões da busca da Home",
                        "Home search suggestions",
                      )}
                    </h2>
                    <p>
                      {tr(
                        "Opcional: sugestões web reais da Brave. O texto digitado é enviado ao provedor; a pesquisa final continua no buscador escolhido pelo usuário.",
                        "Optional: real web suggestions from Brave. Typed text is sent to the provider; the final search still uses the user's chosen engine.",
                      )}
                    </p>
                    <p>
                      {environment.HOME_AUTOCOMPLETE_BRAVE_API_KEY
                        ? tr(
                            "Chave do provedor configurada.",
                            "Provider key configured.",
                          )
                        : tr(
                            "Configure HOME_AUTOCOMPLETE_BRAVE_API_KEY no ambiente do App e do Admin para ativar o serviço. Não há sugestões locais substitutas.",
                            "Configure HOME_AUTOCOMPLETE_BRAVE_API_KEY in the App and Admin environment to enable the service. There are no local substitute suggestions.",
                          )}
                    </p>
                    <form action={saveAutocompleteAction}>
                      <label>
                        <input
                          type="checkbox"
                          name="enabled"
                          defaultChecked={autocomplete.enabled}
                        />
                        {tr(
                          "Permitir sugestões web na Home",
                          "Allow web suggestions on Home",
                        )}
                      </label>
                      <button type="submit">
                        {tr("Salvar busca", "Save search")}
                      </button>
                    </form>
                  </section>
                </>
              ),
            },
            {
              id: "language",
              label: tr("Idioma", "Language"),
              content: (
                <>
                  <section
                    className="admin-system-language"
                    aria-labelledby="instance-language-title"
                  >
                    <h2 id="instance-language-title">
                      <UiCopy
                        pt="Idioma padrão da instância / Instance language"
                        en="Instance default language / Idioma padrão"
                      />
                    </h2>
                    <p>
                      <UiCopy
                        pt="Define o idioma inicial da interface do App e do Control Plane. Cada pessoa mantém sua preferência individual quando disponível. Conteúdo cadastrado não é traduzido."
                        en="Sets the initial language of the App and Control Plane. Each person keeps their individual preference when available. Entered content is not translated."
                      />
                    </p>
                    <form action={setInstanceLanguageAction}>
                      <label htmlFor="instance-language">
                        <UiCopy pt="Idioma / Language" en="Language / Idioma" />
                      </label>
                      <select
                        id="instance-language"
                        name="language"
                        defaultValue={getUiLanguage()}
                      >
                        <option value="en">English</option>
                        <option value="pt-BR">Português</option>
                      </select>
                      <button type="submit">
                        <UiCopy
                          pt="Salvar idioma / Save language"
                          en="Save language / Salvar idioma"
                        />
                      </button>
                    </form>
                  </section>
                </>
              ),
            },
            {
              id: "backup",
              label: tr("Backup", "Backup"),
              content: (
                <>
                  <BackupCenter
                    config={backupConfig()}
                    workerActive={Boolean(
                      backupConfig().workerSeenAt &&
                      Date.now() - backupConfig().workerSeenAt! < 180000,
                    )}
                    configured={hasRecoveryKey()}
                    runs={backupRuns()}
                    driveReady={Boolean(
                      storageOwnerStatus(db)?.connected &&
                      storageOwnerStatus(db)?.rootReady,
                    )}
                  />
                  <details className="admin-system-links">
                    <summary>
                      <UiCopy
                        pt="Exportação antiga sem criptografia"
                        en="Legacy unencrypted export"
                      />
                    </summary>
                    <h2>
                      <UiCopy
                        pt="Exportação sanitizada"
                        en="Sanitized export"
                      />
                    </h2>
                    <p>
                      <UiCopy
                        pt="Cria um ZIP sem criptografia dos dois bancos e dos assets locais. Sessões e tokens de acesso são removidos; após uma restauração, reconecte o Google. O arquivo ainda contém dados privados e hashes de senha: guarde-o em local protegido."
                        en="Creates an unencrypted ZIP of both databases and local assets. Sessions and access tokens are removed; reconnect Google after a restore. The file still contains private data and password hashes, so keep it protected."
                      />
                    </p>
                    <form action={createManualBackupAction}>
                      <button type="submit">
                        <UiCopy pt="Criar backup" en="Create backup" />
                      </button>
                    </form>
                    {backup &&
                    status === "backup-created" &&
                    backups.some((item) => item.id === backup) ? (
                      <p role="status">
                        <a href={`/control/system/backup/${backup}`}>
                          <UiCopy
                            pt="Baixar backup criado"
                            en="Download created backup"
                          />
                        </a>
                      </p>
                    ) : null}
                    {backups.length ? (
                      <ul>
                        {backups.map((item) => (
                          <li key={item.id}>
                            <span>
                              {new Date(item.date).toLocaleString(language)}
                            </span>{" "}
                            <a href={`/control/system/backup/${item.id}`}>
                              <UiCopy pt="Baixar" en="Download" />
                            </a>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p>
                        <UiCopy
                          pt="Nenhum backup criado nesta instalação."
                          en="No backup has been created for this installation."
                        />
                      </p>
                    )}
                    <p>
                      <UiCopy
                        pt="Para restaurar, pare os serviços e use a ferramenta local documentada em"
                        en="To restore, stop the services and use the local tool documented in"
                      />
                      <code>docs/operations/manual-backup-restore.md</code>.
                    </p>
                  </details>
                </>
              ),
            },
            {
              id: "diagnostics",
              label: tr("Diagnóstico", "Diagnostics"),
              content: (
                <>
                  <section className="admin-diagnostics-summary">
                    <h2>
                      <UiCopy
                        pt="Serviços e armazenamento"
                        en="Services and storage"
                      />
                    </h2>
                    <dl>
                      <div>
                        <dt>Realtime</dt>
                        <dd>
                          {operational.realtime === "operational"
                            ? tr("Respondendo", "Responding")
                            : tr(
                                "Sem resposta. Confira o serviço realtime e seu endereço interno.",
                                "No response. Check the realtime service and its internal address.",
                              )}
                        </dd>
                      </div>
                      <div>
                        <dt>
                          <UiCopy pt="Arquivos locais" en="Local files" />
                        </dt>
                        <dd>
                          {operational.storage === "operational"
                            ? tr(
                                "Pasta disponível para leitura e gravação",
                                "Folder available for reading and writing",
                              )
                            : tr(
                                "Confira permissões e espaço disponível",
                                "Check permissions and free space",
                              )}
                        </dd>
                      </div>
                      <div>
                        <dt>
                          <UiCopy
                            pt="Espaço livre no volume"
                            en="Free space on volume"
                          />
                        </dt>
                        <dd>
                          {operational.freeBytes === null
                            ? tr("Indisponível", "Unavailable")
                            : `${(operational.freeBytes / 1024 ** 3).toFixed(1)} GiB`}
                        </dd>
                      </div>
                      <div>
                        <dt>
                          <UiCopy
                            pt="Memória deste processo"
                            en="This process memory"
                          />
                        </dt>
                        <dd>
                          {Math.round(process.memoryUsage().rss / 1024 ** 2)}{" "}
                          MiB
                        </dd>
                      </div>
                    </dl>
                    <p>
                      <UiCopy
                        pt="O diagnóstico de integridade é reutilizado por até um minuto; o estado dos serviços, por até 15 segundos."
                        en="Integrity results are reused for up to one minute; service status, for up to 15 seconds."
                      />
                    </p>
                  </section>
                  <PushSetup configured={Boolean(pushConfiguration())} />
                  <h2>
                    <UiCopy pt="Estado do banco V2" en="V2 database status" />
                  </h2>
                  <p role="status">
                    <UiCopy pt="Integridade:" en="Integrity:" />{" "}
                    {integrity
                      ? tr("sem problemas detectados", "no issues detected")
                      : tr("precisa de verificação", "needs checking")}
                    .
                    <UiCopy pt="Relações:" en="Relations:" />{" "}
                    {foreignKeys
                      ? tr(
                          `${foreignKeys} problema(s) detectado(s)`,
                          `${foreignKeys} issue(s) detected`,
                        )
                      : tr("sem problemas detectados", "no issues detected")}
                    .
                  </p>
                  <section className="admin-diagnostics-summary">
                    <h2>
                      <UiCopy pt="Diagnóstico básico" en="Basic diagnostics" />
                    </h2>
                    <dl>
                      <div>
                        <dt>
                          <UiCopy
                            pt="APP_URL deste processo"
                            en="APP_URL for this process"
                          />
                        </dt>
                        <dd>{environment.APP_URL}</dd>
                      </div>
                      <div>
                        <dt>
                          <UiCopy pt="Migrations V2" en="V2 migrations" />
                        </dt>
                        <dd>{migrations}</dd>
                      </div>
                      <div>
                        <dt>
                          <UiCopy
                            pt="Migrations do banco principal"
                            en="Main database migrations"
                          />
                        </dt>
                        <dd>
                          {legacyMigrations ??
                            tr("sem registro no banco", "no database record")}
                        </dd>
                      </div>
                      <div>
                        <dt>
                          <UiCopy pt="Banco principal" en="Main database" />
                        </dt>
                        <dd>
                          {legacyIntegrity && legacyForeignKeys === 0
                            ? tr("íntegro", "healthy")
                            : tr("precisa de verificação", "needs checking")}
                        </dd>
                      </div>
                      <div>
                        <dt>Google</dt>
                        <dd>
                          {google.config.errors.length === 0
                            ? tr("configurado", "configured")
                            : tr(
                                "precisa de configuração",
                                "needs configuration",
                              )}
                        </dd>
                      </div>
                      <div>
                        <dt>
                          <UiCopy pt="Drive acadêmico" en="Academic Drive" />
                        </dt>
                        <dd>
                          {google.storage?.connected && google.storage.rootReady
                            ? tr("pronto", "ready")
                            : google.storage
                              ? tr("incompleto", "incomplete")
                              : tr("não configurado", "not configured")}
                        </dd>
                      </div>
                      <div>
                        <dt>
                          <UiCopy pt="Superfície" en="Surface" />
                        </dt>
                        <dd>
                          <UiCopy pt="Admin local" en="Local Admin" />
                        </dd>
                      </div>
                      <div>
                        <dt>
                          <UiCopy
                            pt="Escrita no banco principal"
                            en="Main database writes"
                          />
                        </dt>
                        <dd>
                          {storageState(environment.DATABASE_PATH, language)}
                        </dd>
                      </div>
                      <div>
                        <dt>
                          <UiCopy
                            pt="Escrita no banco V2"
                            en="V2 database writes"
                          />
                        </dt>
                        <dd>
                          {storageState(
                            process.env.OPENSTUDYHUB_V2_DATABASE_PATH ?? "",
                            language,
                          )}
                        </dd>
                      </div>
                      <div>
                        <dt>
                          <UiCopy pt="Assets privados" en="Private assets" />
                        </dt>
                        <dd>
                          {storageState(
                            environment.PRIVATE_ASSET_PATH,
                            language,
                          )}
                        </dd>
                      </div>
                      <div>
                        <dt>
                          <UiCopy pt="Versão do pacote" en="Package version" />
                        </dt>
                        <dd>{packageManifest.version}</dd>
                      </div>
                    </dl>
                  </section>
                </>
              ),
            },
          ]}
        />
      </ConsoleShell>
    );
  });
}
