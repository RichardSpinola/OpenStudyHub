import Link from "next/link";

import { AsciiLogo } from "@/components/ascii-logo";
import { HomeBackgroundSettings } from "@/components/home-background-settings";
import { ClassroomSyncAll } from "@/components/classroom-sync-all";
import { ProfileLocaleSelect } from "@/components/profile-locale-select";
import { ProfileMediaSettings } from "@/components/profile-media-settings";
import { ThemeSelect } from "@/components/theme-select";
import { PendingSubmitButton } from "@/components/pending-submit-button";
import { requireAuthenticatedUser } from "@/lib/authorization";
import { canAccessAcademicAdministration } from "@/lib/academic-authority";
import {
  figletFontOptions,
  getAsciiLogo,
  getBrandConfig,
  type BrandConfig,
} from "@/lib/home-settings";
import { getInstitutionName } from "@/lib/institution";
import { listExternalLinks, type ExternalLink } from "@/lib/external-links";
import { getHomeBackground } from "@/lib/home-background";
import { getUserProfile, type UserProfile } from "@/lib/profile";
import { listShortcuts, type Shortcut } from "@/lib/shortcuts";
import { getTranslations } from "@/lib/translations";
import {
  connectGoogleAccountAction,
  disconnectGoogleAccountAction,
} from "@/app/settings/google-actions";
import { getGoogleConnection } from "@/lib/google/connections";
import { getGoogleIntegrationAvailability } from "@/lib/google/config";
import {
  getUiLanguage,
  languageOptions,
  type UiLanguage,
} from "@/lib/ui-language";
import { listUserShortcuts } from "@/lib/user-shortcuts";
import { getStorageLayout } from "@/lib/storage-layout";
import { resolveSettingsSection } from "@/lib/settings-navigation";
import { listEligibleProfileTags } from "@/lib/collaboration";
import { getNotificationPreferences } from "@/lib/notifications";
import { isProjectsFeatureEnabled } from "@/lib/feature-flags";
import {
  getConfiguredDriveStorageOwnerId,
  listDriveStorageOwnerCandidates,
} from "@/lib/google/storage-owner";

import {
  addDemoShortcutsAction,
  createPersonalShortcutAction,
  createShortcutAction,
  deletePersonalShortcutAction,
  deleteShortcutAction,
  movePersonalShortcutAction,
  moveShortcutAction,
  togglePersonalShortcutAction,
  toggleShortcutAction,
  updateIdentityAction,
  updateHomePreferencesAction,
  addExternalLinkAction,
  deleteExternalLinkAction,
  updateInstitutionAction,
  updateLanguageAction,
  updatePersonalShortcutAction,
  updateProfileAction,
  setOwnProfileTagAction,
  updateNotificationPreferencesAction,
  updateProjectsFeatureAction,
  updateShortcutAction,
  updateStorageLayoutAction,
  updateDriveStorageOwnerAction,
} from "./actions";

export const dynamic = "force-dynamic";

type InstanceSettings = {
  asciiLogo: string;
  brand: BrandConfig;
  institutionName: string;
  externalLinks: ExternalLink[];
  language: UiLanguage;
  shortcuts: Shortcut[];
};

type SettingsData =
  | {
      available: true;
      profile: UserProfile;
      personalShortcuts: Shortcut[];
      profileTags: ReturnType<typeof listEligibleProfileTags>;
      notificationPreferences: ReturnType<typeof getNotificationPreferences>;
      instance: InstanceSettings | null;
    }
  | { available: false; language: UiLanguage };

type ShortcutActions = {
  create: (formData: FormData) => Promise<void>;
  update: (formData: FormData) => Promise<void>;
  toggle: (formData: FormData) => Promise<void>;
  move: (formData: FormData) => Promise<void>;
  remove: (formData: FormData) => Promise<void>;
};

function loadSettingsData(userId: number, isAdmin: boolean): SettingsData {
  try {
    const profile = getUserProfile(userId);
    return {
      available: true,
      profile,
      personalShortcuts: listUserShortcuts(userId),
      profileTags: listEligibleProfileTags(userId),
      notificationPreferences: getNotificationPreferences(userId),
      instance: isAdmin
        ? {
            asciiLogo: getAsciiLogo(),
            brand: getBrandConfig(),
            institutionName: getInstitutionName(),
            externalLinks: listExternalLinks(),
            language: getUiLanguage(),
            shortcuts: listShortcuts(),
          }
        : null,
    };
  } catch {
    return { available: false, language: "pt-BR" };
  }
}

function ShortcutManager({
  index,
  title,
  idPrefix,
  items,
  actions,
  language,
  allowExamples = false,
}: {
  index: string;
  title: string;
  idPrefix: string;
  items: Shortcut[];
  actions: ShortcutActions;
  language: UiLanguage;
  allowExamples?: boolean;
}) {
  const { settings, shortcuts } = getTranslations(language);

  return (
    <section
      className="config-panel"
      id={`${idPrefix}s`}
      aria-labelledby={`${idPrefix}-title`}
    >
      <div className="section-heading">
        <span className="panel-index">{index}</span>
        <h2 id={`${idPrefix}-title`}>{title}</h2>
        <span className="count-label">
          {String(items.length).padStart(2, "0")} {settings.itemCount}
        </span>
      </div>

      <form className="shortcut-form" action={actions.create}>
        <div className="field-group">
          <label htmlFor={`${idPrefix}-name`}>{shortcuts.name}</label>
          <input
            id={`${idPrefix}-name`}
            name="name"
            type="text"
            maxLength={80}
            required
          />
        </div>
        <div className="field-group field-url">
          <label htmlFor={`${idPrefix}-url`}>{shortcuts.url}</label>
          <input
            id={`${idPrefix}-url`}
            name="url"
            type="url"
            maxLength={2048}
            placeholder="https://"
            required
          />
        </div>
        <div className="field-group field-icon">
          <label htmlFor={`${idPrefix}-icon`}>{shortcuts.abbreviation}</label>
          <input
            id={`${idPrefix}-icon`}
            name="icon"
            type="text"
            maxLength={8}
            placeholder="WEB"
          />
        </div>
        <button type="submit">{settings.add}</button>
      </form>

      {items.length === 0 ? (
        <div className="empty-state settings-empty">
          <strong>{settings.empty}</strong>
          {allowExamples ? (
            <form action={addDemoShortcutsAction}>
              <button className="secondary-button" type="submit">
                {settings.loadExamples}
              </button>
            </form>
          ) : null}
        </div>
      ) : (
        <ol className="shortcut-admin-list">
          {items.map((shortcut, itemIndex) => (
            <li key={shortcut.id} className="shortcut-admin-item">
              <div className="shortcut-summary">
                <span className="shortcut-icon" aria-hidden="true">
                  {shortcut.icon || "+"}
                </span>
                <div>
                  <strong>{shortcut.name}</strong>
                  <span>
                    {shortcut.enabled ? settings.active : settings.disabled}
                  </span>
                </div>
              </div>

              <div className="compact-actions" aria-label={title}>
                <form action={actions.move}>
                  <input type="hidden" name="id" value={shortcut.id} />
                  <input type="hidden" name="direction" value="up" />
                  <button
                    type="submit"
                    aria-label={`${settings.moveUp}: ${shortcut.name}`}
                    disabled={itemIndex === 0}
                  >
                    ↑
                  </button>
                </form>
                <form action={actions.move}>
                  <input type="hidden" name="id" value={shortcut.id} />
                  <input type="hidden" name="direction" value="down" />
                  <button
                    type="submit"
                    aria-label={`${settings.moveDown}: ${shortcut.name}`}
                    disabled={itemIndex === items.length - 1}
                  >
                    ↓
                  </button>
                </form>
                <form action={actions.toggle}>
                  <input type="hidden" name="id" value={shortcut.id} />
                  <input
                    type="hidden"
                    name="enabled"
                    value={shortcut.enabled ? "false" : "true"}
                  />
                  <button type="submit">
                    {shortcut.enabled ? settings.turnOff : settings.turnOn}
                  </button>
                </form>
              </div>

              <details className="edit-shortcut">
                <summary>[ {settings.edit} ]</summary>
                <form className="stack-form" action={actions.update}>
                  <input type="hidden" name="id" value={shortcut.id} />
                  <label>
                    {shortcuts.name}
                    <input
                      name="name"
                      type="text"
                      defaultValue={shortcut.name}
                      maxLength={80}
                      required
                    />
                  </label>
                  <label>
                    {shortcuts.url}
                    <input
                      name="url"
                      type="url"
                      defaultValue={shortcut.url}
                      maxLength={2048}
                      required
                    />
                  </label>
                  <label>
                    {shortcuts.abbreviation}
                    <input
                      name="icon"
                      type="text"
                      defaultValue={shortcut.icon ?? ""}
                      maxLength={8}
                    />
                  </label>
                  <button type="submit">{settings.save}</button>
                </form>
                <form className="delete-form" action={actions.remove}>
                  <input type="hidden" name="id" value={shortcut.id} />
                  <button type="submit">{settings.delete}</button>
                </form>
              </details>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

const personalShortcutActions: ShortcutActions = {
  create: createPersonalShortcutAction,
  update: updatePersonalShortcutAction,
  toggle: togglePersonalShortcutAction,
  move: movePersonalShortcutAction,
  remove: deletePersonalShortcutAction,
};

const instanceShortcutActions: ShortcutActions = {
  create: createShortcutAction,
  update: updateShortcutAction,
  toggle: toggleShortcutAction,
  move: moveShortcutAction,
  remove: deleteShortcutAction,
};

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ google?: string; section?: string }>;
}) {
  const user = await requireAuthenticatedUser();
  const parameters = await searchParams;
  const data = loadSettingsData(user.id, user.role === "admin");
  const language = data.available ? data.profile.locale : data.language;
  const { settings } = getTranslations(language);
  const googleAvailability = getGoogleIntegrationAvailability();
  const googleConnection = data.available ? getGoogleConnection(user.id) : null;
  const canAdminister = canAccessAcademicAdministration(user.id);
  const storageLayout = user.role === "admin" ? getStorageLayout() : null;
  const storageOwnerCandidates =
    user.role === "admin" ? listDriveStorageOwnerCandidates() : [];
  const configuredStorageOwnerId =
    user.role === "admin" ? getConfiguredDriveStorageOwnerId() : null;
  const projectsEnabled =
    user.role === "admin" ? isProjectsFeatureEnabled() : true;
  const section = resolveSettingsSection(parameters.section, {
    instance: Boolean(data.available && data.instance),
    administration: canAdminister,
    storage: Boolean(storageLayout),
  });
  const homeBackground = data.available ? getHomeBackground(user.id) : null;

  return (
    <div className="settings-shell">
      <header className="page-heading">
        <div>
          <p className="system-label">{settings.system}</p>
          <h1>{settings.title}</h1>
          <p className="page-description">
            Perfil, preferências, integrações e personalização.
          </p>
        </div>
        <Link className="text-link" href="/">
          ← {settings.home}
        </Link>
      </header>
      <nav className="section-tabs settings-tabs" aria-label="Configurações">
        <Link
          href="/settings?section=profile"
          aria-current={section === "profile" ? "page" : undefined}
        >
          Perfil
        </Link>
        <Link
          href="/settings?section=personalization"
          aria-current={section === "personalization" ? "page" : undefined}
        >
          Personalização
        </Link>
        <Link
          href="/settings?section=google"
          aria-current={section === "google" ? "page" : undefined}
        >
          Google
        </Link>
        {data.available && data.instance ? (
          <Link
            href="/settings?section=instance"
            aria-current={section === "instance" ? "page" : undefined}
          >
            Instância
          </Link>
        ) : null}
        {canAdminister ? (
          <Link
            href="/settings?section=administration"
            aria-current={
              section === "administration" || section === "storage"
                ? "page"
                : undefined
            }
          >
            Administração
          </Link>
        ) : null}
      </nav>

      {!data.available ? (
        <section className="config-panel" role="alert">
          <h2>{settings.databaseUnavailable}</h2>
          <p>{settings.checkMigrations}</p>
        </section>
      ) : (
        <>
          {section === "profile" ? (
            <section
              className="config-panel settings-pane"
              aria-labelledby="profile-title"
            >
              <div className="section-heading">
                <span className="panel-index">01</span>
                <h2 id="profile-title">{settings.profile}</h2>
              </div>
              <form className="stack-form" action={updateProfileAction}>
                <label htmlFor="profile-display-name">
                  {settings.displayName}
                </label>
                <input
                  id="profile-display-name"
                  name="displayName"
                  type="text"
                  minLength={2}
                  maxLength={120}
                  defaultValue={data.profile.displayName}
                  required
                />
                <ProfileLocaleSelect
                  label={settings.languageLabel}
                  locale={data.profile.locale}
                />
                <label htmlFor="profile-bio">Bio</label>
                <textarea
                  id="profile-bio"
                  name="bio"
                  maxLength={500}
                  defaultValue={data.profile.bio}
                  rows={4}
                />
                <div className="form-actions">
                  <span>{settings.personalPreferences}</span>
                  <button type="submit">{settings.saveProfile}</button>
                </div>
              </form>
              <ProfileMediaSettings
                userId={data.profile.id}
                hasAvatar={Boolean(data.profile.avatarStorageName)}
                hasBanner={Boolean(data.profile.bannerStorageName)}
              />
              {data.profileTags.length ? (
                <div className="profile-tag-settings">
                  <strong>VISUAL TAGS</strong>
                  {data.profileTags.map((tag) => (
                    <form key={tag.id} action={setOwnProfileTagAction}>
                      <input type="hidden" name="tagId" value={tag.id} />
                      <input
                        type="hidden"
                        name="assigned"
                        value={tag.assigned ? "false" : "true"}
                      />
                      <span>{tag.label}</span>
                      <button type="submit" disabled={!tag.selfAssignable}>
                        {tag.assigned ? "Remover" : "Adicionar"}
                      </button>
                    </form>
                  ))}
                </div>
              ) : null}
              <form
                className="stack-form"
                action={updateNotificationPreferencesAction}
              >
                <strong>NOTIFICAÇÕES</strong>
                <label>
                  Conversas diretas
                  <select
                    name="dm"
                    defaultValue={data.notificationPreferences.dm}
                  >
                    <option value="all">Todas</option>
                    <option value="mentions">Menções</option>
                    <option value="none">Nenhuma</option>
                  </select>
                </label>
                <label>
                  Grupos
                  <select
                    name="groupDefault"
                    defaultValue={data.notificationPreferences.groupDefault}
                  >
                    <option value="all">Todas</option>
                    <option value="mentions">Menções</option>
                    <option value="none">Nenhuma</option>
                  </select>
                </label>
                <label>
                  Audiências
                  <select
                    name="audienceDefault"
                    defaultValue={data.notificationPreferences.audienceDefault}
                  >
                    <option value="all">Todas</option>
                    <option value="mentions">Menções</option>
                    <option value="none">Nenhuma</option>
                  </select>
                </label>
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    name="desktopEnabled"
                    value="true"
                    defaultChecked={data.notificationPreferences.desktopEnabled}
                  />
                  Notificação do sistema enquanto o Hub estiver aberto
                </label>
                <input type="hidden" name="mentionsEnabled" value="true" />
                <input type="hidden" name="repliesEnabled" value="true" />
                <button type="submit">Salvar notificações</button>
              </form>
            </section>
          ) : null}

          {section === "personalization" ? (
            <div className="settings-pane settings-personalization">
              <section
                className="config-panel"
                aria-labelledby="personalization-title"
              >
                <div className="section-heading">
                  <span className="panel-index">01</span>
                  <h2 id="personalization-title">Home e aparência</h2>
                </div>
                <form
                  className="stack-form"
                  action={updateHomePreferencesAction}
                >
                  <label>
                    Tema
                    <ThemeSelect defaultValue={data.profile.theme} />
                  </label>
                  <label className="checkbox-label">
                    <input
                      name="homeClockEnabled"
                      type="checkbox"
                      value="true"
                      defaultChecked={data.profile.homeClockEnabled}
                    />
                    Mostrar relógio na Home
                  </label>
                  <label>
                    Posição do relógio
                    <select
                      name="homeClockPosition"
                      defaultValue={data.profile.homeClockPosition}
                    >
                      <option value="top-left">Superior esquerdo</option>
                      <option value="top-right">Superior direito</option>
                      <option value="bottom-left">Inferior esquerdo</option>
                      <option value="bottom-right">Inferior direito</option>
                    </select>
                  </label>
                  <label className="checkbox-label">
                    <input
                      name="todayWidgetEnabled"
                      type="checkbox"
                      value="true"
                      defaultChecked={data.profile.todayWidgetEnabled}
                    />
                    {settings.todayWidget}
                  </label>
                  <button type="submit">Salvar aparência</button>
                </form>
                <div className="home-background-control">
                  <h3>Plano de fundo da Home</h3>
                  <HomeBackgroundSettings
                    configured={homeBackground !== null}
                  />
                </div>
              </section>
              <ShortcutManager
                index="02"
                title={settings.personalShortcuts}
                idPrefix="personal-shortcut"
                items={data.personalShortcuts}
                actions={personalShortcutActions}
                language={language}
              />
            </div>
          ) : null}

          {section === "google" ? (
            <section
              className="config-panel settings-pane"
              aria-labelledby="google-title"
            >
              <div className="section-heading">
                <span className="panel-index">03</span>
                <h2 id="google-title">{settings.googleIntegration}</h2>
              </div>
              <div className="google-connection-summary">
                <strong>
                  {!googleAvailability.configured
                    ? settings.googleUnavailable
                    : googleConnection?.status === "connected"
                      ? settings.googleConnected
                      : googleConnection?.status === "revoked"
                        ? settings.googleRevoked
                        : settings.googleDisconnected}
                </strong>
                {googleConnection?.accountEmail ? (
                  <span>{googleConnection.accountEmail}</span>
                ) : null}
                <small>{settings.googlePrivacy}</small>
                {googleConnection?.status === "connected" ? (
                  <>
                    <small>{settings.googleCapabilities}</small>
                    <div
                      className="capability-list"
                      aria-label="Recursos Google"
                    >
                      <span>✓ Drive disponível</span>
                      <span>✓ Classroom disponível</span>
                      <span>✓ Docs disponível</span>
                    </div>
                    <ClassroomSyncAll />
                  </>
                ) : null}
                {!googleAvailability.configured && user.role === "admin" ? (
                  <small>{googleAvailability.missing.join(" // ")}</small>
                ) : null}
              </div>
              {parameters.google === "error" ? (
                <p className="form-error" role="alert">
                  {settings.googleDisconnected}
                </p>
              ) : null}
              {googleConnection ? (
                <form action={disconnectGoogleAccountAction}>
                  <button type="submit">{settings.googleDisconnect}</button>
                </form>
              ) : (
                <form action={connectGoogleAccountAction}>
                  <button
                    type="submit"
                    disabled={!googleAvailability.configured}
                  >
                    {settings.googleConnect}
                  </button>
                </form>
              )}
            </section>
          ) : null}

          {canAdminister && section === "administration" ? (
            <section
              className="administration-settings"
              id="administration"
              aria-labelledby="administration-title"
            >
              <div className="section-heading administration-heading">
                <span className="panel-index">04</span>
                <h2 id="administration-title">Administração</h2>
              </div>
              <div className="admin-settings-links">
                <Link href="/admin/users">
                  <strong>Usuários</strong>
                  <span>Contas, matrículas, permissões e Visual Tags</span>
                </Link>
                <Link href="/admin/academic">
                  <strong>Acadêmico</strong>
                  <span>Programas, turmas, disciplinas e integrações</span>
                </Link>
                <Link href="/admin/academic?section=integrations">
                  <strong>Integrações</strong>
                  <span>Drive, Classroom e Notebook por oferta</span>
                </Link>
                {user.role === "admin" ? (
                  <>
                    <Link href="/admin/audit">
                      <strong>Auditoria</strong>
                      <span>Eventos administrativos recentes</span>
                    </Link>
                    <Link href="/settings?section=storage">
                      <strong>Armazenamento</strong>
                      <span>Layout lazy de pastas no Drive</span>
                    </Link>
                    <Link href="/settings?section=instance">
                      <strong>Instância</strong>
                      <span>Identidade e defaults públicos</span>
                    </Link>
                  </>
                ) : null}
              </div>
            </section>
          ) : null}

          {storageLayout && section === "storage" ? (
            <section
              className="config-panel storage-settings"
              id="storage"
              aria-labelledby="storage-title"
            >
              <div className="section-heading">
                <span className="panel-index">05</span>
                <h2 id="storage-title">Armazenamento</h2>
              </div>
              <form
                className="stack-form"
                action={updateDriveStorageOwnerAction}
              >
                <h3>Drive central da instância</h3>
                <p className="panel-help">
                  A conta escolhida controla pastas acadêmicas, templates e
                  documentos novos. Classroom continua usando a conexão de cada
                  usuário.
                </p>
                <label>
                  Conta de armazenamento
                  <select
                    key={configuredStorageOwnerId ?? "legacy"}
                    name="storageOwnerUserId"
                    defaultValue={configuredStorageOwnerId ?? ""}
                  >
                    <option value="">Pessoal / legado</option>
                    {storageOwnerCandidates.map((candidate) => (
                      <option key={candidate.userId} value={candidate.userId}>
                        {candidate.displayName}
                        {candidate.accountEmail
                          ? ` — ${candidate.accountEmail}`
                          : ""}
                      </option>
                    ))}
                  </select>
                </label>
                {configuredStorageOwnerId !== null &&
                !storageOwnerCandidates.some(
                  ({ userId }) => userId === configuredStorageOwnerId,
                ) ? (
                  <p className="form-error" role="alert">
                    A conta central configurada não está disponível. Operações
                    de escrita no Drive central permanecem bloqueadas até a
                    configuração ser corrigida.
                  </p>
                ) : null}
                <PendingSubmitButton pendingLabel="Salvando Drive central…">
                  Salvar Drive central
                </PendingSubmitButton>
              </form>
              <form className="stack-form" action={updateStorageLayoutAction}>
                <p className="panel-help">
                  Define nomes futuros. Alterar este layout não move pastas já
                  criadas no Drive.
                </p>
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    name="includeCohort"
                    value="true"
                    defaultChecked={storageLayout.includeCohort}
                  />
                  Incluir turma quando estiver disponível
                </label>
                <details className="advanced-settings">
                  <summary>Padrões de nomes</summary>
                  <div className="stack-form">
                    <label>
                      Programa
                      <input
                        name="programPattern"
                        defaultValue={storageLayout.patterns.program}
                        required
                      />
                    </label>
                    <label>
                      Turma
                      <input
                        name="cohortPattern"
                        defaultValue={storageLayout.patterns.cohort}
                        required
                      />
                    </label>
                    <label>
                      Período
                      <input
                        name="periodPattern"
                        defaultValue={storageLayout.patterns.period}
                        required
                      />
                    </label>
                    <label>
                      Disciplina
                      <input
                        name="subjectPattern"
                        defaultValue={storageLayout.patterns.subject}
                        required
                      />
                    </label>
                  </div>
                </details>
                <fieldset className="storage-categories">
                  <legend>Categorias</legend>
                  {storageLayout.categories.map((category) => (
                    <div key={category.key}>
                      <label className="checkbox-label">
                        <input
                          type="checkbox"
                          name={`categoryEnabled:${category.key}`}
                          value="true"
                          defaultChecked={category.enabled}
                        />
                        {category.kind}
                      </label>
                      <input
                        name={`categoryLabel:${category.key}`}
                        defaultValue={category.label}
                        maxLength={80}
                        required
                        aria-label={`Nome da categoria ${category.kind}`}
                      />
                    </div>
                  ))}
                </fieldset>
                <button type="submit">Salvar organização</button>
              </form>
            </section>
          ) : null}

          {data.instance && section === "instance" ? (
            <>
              <section className="config-panel" aria-labelledby="brand-title">
                <div className="section-heading">
                  <span className="panel-index">04</span>
                  <h2 id="brand-title">{settings.instanceSettings}</h2>
                </div>

                <form className="language-form" action={updateLanguageAction}>
                  <label htmlFor="ui-language">
                    {settings.instanceLanguage}
                  </label>
                  <select
                    id="ui-language"
                    name="language"
                    defaultValue={data.instance.language}
                  >
                    {languageOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  <button type="submit">{settings.apply}</button>
                </form>

                <form
                  className="stack-form institution-form"
                  action={updateProjectsFeatureAction}
                >
                  <strong>Recursos da instância</strong>
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      name="projectsEnabled"
                      value="true"
                      defaultChecked={projectsEnabled}
                    />
                    Mostrar Projetos nas disciplinas
                  </label>
                  <div className="form-actions">
                    <span>
                      Desativar oculta a UI sem apagar projetos ou versões
                      existentes.
                    </span>
                    <button type="submit">Salvar recursos</button>
                  </div>
                </form>

                <section className="stack-form institution-form external-links-settings">
                  <div>
                    <strong>Links externos</strong>
                    <p>
                      Atalhos compartilhados no rodapé da instância, como
                      documentação, Drive acadêmico ou portal institucional.
                    </p>
                  </div>
                  <form
                    className="external-link-create"
                    action={addExternalLinkAction}
                  >
                    <label htmlFor="external-link-label">Nome</label>
                    <input
                      id="external-link-label"
                      name="label"
                      type="text"
                      maxLength={80}
                      placeholder="Documentação"
                      required
                    />
                    <label htmlFor="external-link-url">URL</label>
                    <input
                      id="external-link-url"
                      name="url"
                      type="url"
                      maxLength={2048}
                      placeholder="https://docs.example.org"
                      required
                    />
                    <label className="checkbox-label">
                      <input
                        name="newTab"
                        type="checkbox"
                        value="true"
                        defaultChecked
                      />
                      Abrir em nova aba
                    </label>
                    <button type="submit">Adicionar link</button>
                  </form>
                  {data.instance.externalLinks.length ? (
                    <ul className="external-link-admin-list">
                      {data.instance.externalLinks.map((link) => (
                        <li key={link.id}>
                          <div>
                            <strong>{link.label}</strong>
                            <span>{link.url}</span>
                          </div>
                          <form action={deleteExternalLinkAction}>
                            <input
                              type="hidden"
                              name="linkId"
                              value={link.id}
                            />
                            <button type="submit">Remover</button>
                          </form>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <small>Nenhum link externo configurado.</small>
                  )}
                  <small>
                    HTTPS em produção; localhost HTTP apenas em desenvolvimento.
                  </small>
                </section>

                <form
                  className="stack-form institution-form"
                  action={updateInstitutionAction}
                >
                  <label htmlFor="institution-name">
                    {settings.institutionName}
                  </label>
                  <input
                    id="institution-name"
                    name="institutionName"
                    type="text"
                    defaultValue={data.instance.institutionName}
                    maxLength={160}
                  />
                  <div className="form-actions">
                    <span>{settings.institutionHint}</span>
                    <button type="submit">{settings.saveInstitution}</button>
                  </div>
                </form>

                <form
                  className="stack-form brand-form"
                  action={updateIdentityAction}
                >
                  <label htmlFor="brand-text">{settings.brandText}</label>
                  <input
                    id="brand-text"
                    name="brandText"
                    type="text"
                    defaultValue={data.instance.brand.text}
                    maxLength={20}
                    required
                  />
                  <label htmlFor="brand-font">{settings.figletStyle}</label>
                  <select
                    id="brand-font"
                    name="brandFont"
                    defaultValue={data.instance.brand.font}
                  >
                    {figletFontOptions.map((font) => (
                      <option key={font} value={font}>
                        {font}
                      </option>
                    ))}
                  </select>
                  <span className="preview-label">{settings.preview}</span>
                  <div className="brand-preview">
                    <AsciiLogo value={data.instance.asciiLogo} />
                  </div>
                  <div className="form-actions">
                    <span>FIGLET // SERVER</span>
                    <button type="submit">{settings.saveBrand}</button>
                  </div>
                </form>
              </section>

              <ShortcutManager
                index="05"
                title={settings.defaultShortcuts}
                idPrefix="default-shortcut"
                items={data.instance.shortcuts}
                actions={instanceShortcutActions}
                language={language}
                allowExamples
              />
            </>
          ) : null}
        </>
      )}
    </div>
  );
}
