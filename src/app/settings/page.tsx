import { UiCopy } from "@/components/ui-language-provider";
import Link from "next/link";
import packageMetadata from "../../../package.json";

import { AsciiLogo } from "@/components/ascii-logo";
import { HomeBackgroundSettings } from "@/components/home-background-settings";
import { ClassroomSyncAll } from "@/components/classroom-sync-all";
import { ProfileLocaleSelect } from "@/components/profile-locale-select";
import { ProfileMediaSettings } from "@/components/profile-media-settings";
import { ThemeSelect } from "@/components/theme-select";
import { AppearanceControls } from "@/components/appearance-controls";
import { PushControls } from "@/components/push-controls";
import {
  CanonicalCheckbox,
  CanonicalSelect,
} from "@/components/canonical-form-controls";
import { getAppearance } from "@/lib/appearance";
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
import { getWallpaperCatalog } from "@/lib/home-wallpapers";
import { getUserProfile, type UserProfile } from "@/lib/profile";
import { listShortcuts, type Shortcut } from "@/lib/shortcuts";
import { getTranslations, uiText } from "@/lib/translations";
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
import { currentUserV2, withV2DbAsync } from "@/lib/v2/runtime";
import { googleHealthStatus } from "@/lib/v2/google-health";
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
  updateHomeSearchAction,
  updateAccessibilityAction,
  deactivateOwnV2AccountAction,
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
  searchParams: Promise<{ google?: string; section?: string; links?: string }>;
}) {
  const user = await requireAuthenticatedUser();
  const parameters = await searchParams;
  const data = loadSettingsData(user.id, user.role === "admin");
  const language = data.available ? data.profile.locale : data.language;
  const tr = (pt: string, en: string) => uiText(language, pt, en);
  const { settings } = getTranslations(language);
  const v2Mode = process.env.OPENSTUDYHUB_V2_ENABLED === "1";
  const appearance = v2Mode ? getAppearance(user.id) : null;
  const googleAvailability = getGoogleIntegrationAvailability();
  const googleConnection =
    !v2Mode && data.available ? getGoogleConnection(user.id) : null;
  const googleHealth =
    v2Mode && parameters.section === "google"
      ? await withV2DbAsync(async (db) => {
          const v2User = await currentUserV2(db);
          return v2User ? googleHealthStatus(db, v2User.id) : null;
        })
      : null;
  const canAdminister = canAccessAcademicAdministration(user.id);
  const storageLayout = user.role === "admin" ? getStorageLayout() : null;
  const storageOwnerCandidates =
    user.role === "admin" ? listDriveStorageOwnerCandidates() : [];
  const configuredStorageOwnerId =
    user.role === "admin" ? getConfiguredDriveStorageOwnerId() : null;
  const projectsEnabled =
    user.role === "admin" ? isProjectsFeatureEnabled() : true;
  const section = resolveSettingsSection(parameters.section, {
    instance: !v2Mode && Boolean(data.available && data.instance),
    administration: !v2Mode && canAdminister,
    storage: !v2Mode && Boolean(storageLayout),
  });
  const homeBackground = data.available ? getHomeBackground(user.id) : null;
  const wallpaperCatalog =
    data.available && v2Mode
      ? getWallpaperCatalog(user.id, homeBackground !== null)
      : undefined;

  return (
    <div className="settings-shell">
      <header className="page-heading">
        <div>
          <p className="system-label">
            <UiCopy pt="PREFERÊNCIAS" en="PREFERENCES" />
          </p>
          <h1>
            <UiCopy pt="Configurações" en="Settings" />
          </h1>
          <p className="page-description">
            <UiCopy
              pt="Perfil, preferências, integrações e personalização."
              en="Profile, preferences, integrations and customization."
            />
          </p>
        </div>
      </header>
        <nav className="section-tabs settings-tabs" aria-label={tr("Configurações", "Settings")}>
        <Link
          href="/settings?section=profile"
          aria-current={section === "profile" ? "page" : undefined}
        >
          <UiCopy pt="Conta e Perfil" en="Account and Profile" />
        </Link>
        <Link
          href="/settings?section=personalization"
          aria-current={section === "personalization" ? "page" : undefined}
        >
          <UiCopy pt="Personalização" en="Customization" />
        </Link>
        <Link
          href="/settings?section=google"
          aria-current={section === "google" ? "page" : undefined}
        >
          <UiCopy pt="Integrações" en="Integrations" />
        </Link>
        <Link
          href="/settings?section=notifications"
          aria-current={section === "notifications" ? "page" : undefined}
        >
          <UiCopy pt="Notificações" en="Notifications" />
        </Link>
        <Link
          href="/settings?section=help"
          aria-current={section === "help" ? "page" : undefined}
        >
          <UiCopy pt="Ajuda e Tutoriais" en="Help and Tutorials" />
        </Link>
        <Link
          href="/settings?section=about"
          aria-current={section === "about" ? "page" : undefined}
        >
          <UiCopy pt="Sobre" en="About" />
        </Link>
        {!v2Mode && data.available && data.instance ? (
          <Link
            href="/settings?section=instance"
            aria-current={section === "instance" ? "page" : undefined}
          >
            <UiCopy pt="Instância" en="Instance" />
          </Link>
        ) : null}
        {!v2Mode && canAdminister ? (
          <Link
            href="/settings?section=administration"
            aria-current={
              section === "administration" || section === "storage"
                ? "page"
                : undefined
            }
          >
            <UiCopy pt="Administração" en="Administration" />
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
                <h2 id="profile-title">
                  <UiCopy pt="Conta e Perfil" en="Account and Profile" />
                </h2>
              </div>
              <ProfileMediaSettings
                userId={data.profile.id}
                hasAvatar={Boolean(data.profile.avatarStorageName)}
                hasBanner={Boolean(data.profile.bannerStorageName)}
              />
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
                        {tag.assigned
                          ? tr("Remover", "Remove")
                          : tr("Adicionar", "Add")}
                      </button>
                    </form>
                  ))}
                </div>
              ) : null}
            </section>
          ) : null}

          {section === "notifications" ? (
            <section
              className="config-panel settings-pane"
              aria-labelledby="notifications-title"
            >
              <div className="section-heading">
                <span className="panel-index">04</span>
                <h2 id="notifications-title">
                  <UiCopy pt="Notificações" en="Notifications" />
                </h2>
              </div>
              <form
                className="stack-form"
                action={updateNotificationPreferencesAction}
              >
                <strong>
                  <UiCopy pt="NOTIFICAÇÕES" en="NOTIFICATIONS" />
                </strong>
                <label>
                  <UiCopy pt="Conversas diretas" en="Direct conversations" />
                  <select
                    name="dm"
                    defaultValue={data.notificationPreferences.dm}
                  >
                    <option value="all">
                      <UiCopy pt="Todas" en="All" />
                    </option>
                    <option value="mentions">
                      <UiCopy pt="Menções" en="Mentions" />
                    </option>
                    <option value="none">
                      <UiCopy pt="Nenhuma" en="None" />
                    </option>
                  </select>
                </label>
                <label>
                  <UiCopy pt="Grupos" en="Groups" />
                  <select
                    name="groupDefault"
                    defaultValue={data.notificationPreferences.groupDefault}
                  >
                    <option value="all">
                      <UiCopy pt="Todas" en="All" />
                    </option>
                    <option value="mentions">
                      <UiCopy pt="Menções" en="Mentions" />
                    </option>
                    <option value="none">
                      <UiCopy pt="Nenhuma" en="None" />
                    </option>
                  </select>
                </label>
                <label>
                  <UiCopy pt="Audiências" en="Audiences" />
                  <select
                    name="audienceDefault"
                    defaultValue={data.notificationPreferences.audienceDefault}
                  >
                    <option value="all">
                      <UiCopy pt="Todas" en="All" />
                    </option>
                    <option value="mentions">
                      <UiCopy pt="Menções" en="Mentions" />
                    </option>
                    <option value="none">
                      <UiCopy pt="Nenhuma" en="None" />
                    </option>
                  </select>
                </label>
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    name="desktopEnabled"
                    value="true"
                    defaultChecked={data.notificationPreferences.desktopEnabled}
                  />
                  <UiCopy
                    pt="Notificação do sistema enquanto o Hub estiver aberto"
                    en="System notification while the Hub is open"
                  />
                </label>
                <input type="hidden" name="mentionsEnabled" value="true" />
                <input type="hidden" name="repliesEnabled" value="true" />
                <button type="submit">
                  <UiCopy pt="Salvar notificações" en="Save notifications" />
                </button>
              </form>
              <div className="settings-push-panel">
                <h3>
                  <UiCopy
                    pt="Notificações em segundo plano"
                    en="Background notifications"
                  />
                </h3>
                <p>
                  <UiCopy
                    pt="Ative neste dispositivo para receber avisos mesmo com o Hub fechado. A permissão depende do navegador."
                    en="Enable on this device to receive alerts even when the Hub is closed. Permission depends on the browser."
                  />
                </p>
                <PushControls />
              </div>
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
                  <h2 id="personalization-title">
                    <UiCopy pt="Aparência e Home" en="Appearance and Home" />
                  </h2>
                </div>
                <form
                  className="stack-form home-preferences-form"
                  action={updateHomePreferencesAction}
                >
                  <h3>Home</h3>
                  {process.env.OPENSTUDYHUB_V2_ENABLED === "1" ? (
                    <input
                      type="hidden"
                      name="theme"
                      value={data.profile.theme}
                    />
                  ) : (
                    <label>
                      <UiCopy pt="Tema" en="Theme" />
                      <ThemeSelect defaultValue={data.profile.theme} />
                    </label>
                  )}
                  <label className="checkbox-label">
                    <CanonicalCheckbox
                      key={`clock-${data.profile.homeClockEnabled}`}
                      name="homeClockEnabled"
                      checked={data.profile.homeClockEnabled}
                    />
                    <UiCopy
                      pt="Mostrar relógio na Home"
                      en="Show clock on Home"
                    />
                  </label>
                  <label>
                    <UiCopy pt="Posição do relógio" en="Clock position" />
                    <CanonicalSelect
                      key={`position-${data.profile.homeClockPosition}`}
                      name="homeClockPosition"
                      value={data.profile.homeClockPosition}
                    >
                      <option value="top-left">
                        <UiCopy pt="Superior esquerdo" en="Top left" />
                      </option>
                      <option value="top-right">
                        <UiCopy pt="Superior direito" en="Top right" />
                      </option>
                      <option value="bottom-left">
                        <UiCopy pt="Inferior esquerdo" en="Bottom left" />
                      </option>
                      <option value="bottom-right">
                        <UiCopy pt="Inferior direito" en="Bottom right" />
                      </option>
                    </CanonicalSelect>
                  </label>
                  <label className="checkbox-label">
                    <CanonicalCheckbox
                      key={`today-${data.profile.todayWidgetEnabled}`}
                      name="todayWidgetEnabled"
                      checked={data.profile.todayWidgetEnabled}
                    />
                    {settings.todayWidget}
                  </label>
                  <button type="submit">
                    <UiCopy pt="Salvar Home" en="Save Home" />
                  </button>
                </form>
                {v2Mode ? (
                  <form
                    className="stack-form home-search-form"
                    action={updateHomeSearchAction}
                  >
                    <h3>
                      <UiCopy pt="Busca da Home" en="Home search" />
                    </h3>
                    <label>
                      <UiCopy pt="Mecanismo de busca" en="Search provider" />
                      <CanonicalSelect
                        key={`search-${appearance?.searchEngine ?? "google"}`}
                        name="searchEngine"
                        value={appearance?.searchEngine ?? "google"}
                      >
                        <option value="google">Google</option>
                        <option value="scholar">Google Scholar</option>
                        <option value="duckduckgo">DuckDuckGo</option>
                        <option value="startpage">Startpage</option>
                        <option value="ecosia">Ecosia</option>
                      </CanonicalSelect>
                    </label>
                    <button type="submit">
                      <UiCopy pt="Salvar busca" en="Save search" />
                    </button>
                  </form>
                ) : null}
                {process.env.OPENSTUDYHUB_V2_ENABLED === "1" ? (
                  <div className="stack-form appearance-form">
                    <h3>
                      <UiCopy
                        pt="Aparência do aplicativo"
                        en="App appearance"
                      />
                    </h3>
                    <p>
                      <UiCopy
                        pt="Escolha tema, modo, cor de destaque, densidade e posição da navegação."
                        en="Choose theme, mode, accent color, density and navigation position."
                      />
                    </p>
                    {appearance ? (
                      <AppearanceControls
                        key={JSON.stringify(appearance)}
                        initial={appearance}
                      />
                    ) : null}
                  </div>
                ) : null}
                <div className="home-background-control">
                  <h3>
                    <UiCopy pt="Plano de fundo da Home" en="Home background" />
                  </h3>
                  <HomeBackgroundSettings
                    configured={homeBackground !== null}
                    catalog={wallpaperCatalog}
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
              {v2Mode ? (
                <div className="settings-google-overview">
                  <div className="settings-google-intro">
                    <span className="page-kicker">
                      <UiCopy
                        pt="INTEGRAÇÃO PESSOAL"
                        en="PERSONAL INTEGRATION"
                      />
                    </span>
                    <h3>
                      <UiCopy
                        pt="Seu espaço Google no OpenStudyHub"
                        en="Your Google space in OpenStudyHub"
                      />
                    </h3>
                    <p>
                      <UiCopy
                        pt="Acompanhe sua conexão e gerencie Classroom e Drive em um só lugar."
                        en="Follow your connection and manage Classroom and Drive in one place."
                      />
                    </p>
                    <Link className="settings-google-action" href="/google">
                      {googleHealth?.connection === "needs_reconnect"
                        ? tr("Reconectar Google →", "Reconnect Google →")
                        : googleHealth?.connection === "connected"
                          ? tr("Gerenciar integração →", "Manage integration →")
                          : tr("Conectar Google →", "Connect Google →")}
                    </Link>
                  </div>
                  <div className="settings-google-status">
                    <span>
                      <UiCopy pt="ESTADO DA CONTA" en="ACCOUNT STATUS" />
                    </span>
                    <strong
                      data-state={
                        googleHealth?.connection === "needs_reconnect"
                          ? "needs_reconnect"
                          : googleHealth?.result === "temporary_error"
                            ? "temporary_error"
                            : (googleHealth?.connection ?? "not_connected")
                      }
                    >
                      {googleHealth?.connection === "needs_reconnect"
                        ? tr("Precisa reconectar", "Needs reconnection")
                        : googleHealth?.result === "temporary_error"
                          ? tr(
                              "Verificação temporariamente indisponível",
                              "Check temporarily unavailable",
                            )
                          : googleHealth?.connection === "connected"
                            ? tr("Conectada", "Connected")
                            : tr("Não conectada", "Not connected")}
                    </strong>
                    <p>
                      {googleHealth?.connection === "needs_reconnect"
                        ? tr(
                            "A autorização precisa ser renovada para continuar a sincronização.",
                            "Authorization must be renewed to continue syncing.",
                          )
                        : googleHealth?.result === "temporary_error"
                          ? tr(
                              "A conexão será verificada novamente. Seus dados locais continuam aqui.",
                              "The connection will be checked again. Your local data remains here.",
                            )
                          : googleHealth?.connection === "connected"
                            ? tr(
                                "Acesse seus Classrooms, associações e sincronização na página Google.",
                                "Access your Classrooms, mappings and sync on the Google page.",
                              )
                            : tr(
                                "Conecte sua conta para começar a importar seus Classrooms.",
                                "Connect your account to start importing your Classrooms.",
                              )}
                    </p>
                    <small>
                      {tr("Última verificação", "Last check")}:{" "}
                      {googleHealth?.checkedAt
                        ? new Intl.DateTimeFormat(language, {
                            dateStyle: "short",
                            timeStyle: "short",
                          }).format(googleHealth.checkedAt)
                        : tr("ainda não realizada", "not yet performed")}
                    </small>
                  </div>
                </div>
              ) : (
                <>
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
                          aria-label={tr("Recursos Google", "Google features")}
                        >
                          <span>
                            <UiCopy
                              pt="✓ Drive disponível"
                              en="✓ Drive available"
                            />
                          </span>
                          <span>
                            <UiCopy
                              pt="✓ Classroom disponível"
                              en="✓ Classroom available"
                            />
                          </span>
                          <span>
                            <UiCopy
                              pt="✓ Docs disponível"
                              en="✓ Docs available"
                            />
                          </span>
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
                </>
              )}
            </section>
          ) : null}

          {section === "privacy" ? (
            <section
              className="config-panel settings-pane"
              aria-labelledby="privacy-title"
            >
              <div className="section-heading">
                <span className="panel-index">05</span>
                <h2 id="privacy-title">
                  <UiCopy pt="Privacidade e Dados" en="Privacy and Data" />
                </h2>
              </div>
              <p>
                <UiCopy
                  pt="Sua conta Google e seus Classrooms são pessoais. Você pode revisar ou desconectar a integração quando quiser."
                  en="Your Google account and Classrooms are personal. You can review or disconnect the integration whenever you want."
                />
              </p>
              <div className="settings-link-list">
                <Link href="/google">
                  <UiCopy
                    pt="Gerenciar conexão Google →"
                    en="Manage Google connection →"
                  />
                </Link>
                <Link href="/settings?section=notifications">
                  <UiCopy
                    pt="Preferências de notificação →"
                    en="Notification preferences →"
                  />
                </Link>
                <Link href="/settings?section=profile">
                  <UiCopy pt="Dados do perfil →" en="Profile details →" />
                </Link>
              </div>
            </section>
          ) : null}
          {section === "accessibility" ? (
            <section
              className="config-panel settings-pane"
              aria-labelledby="accessibility-title"
            >
              <div className="section-heading">
                <span className="panel-index">06</span>
                <h2 id="accessibility-title">
                  <UiCopy pt="Acessibilidade" en="Accessibility" />
                </h2>
              </div>
              <p>
                <UiCopy
                  pt="Escolha como o aplicativo responde ao movimento e ao contraste."
                  en="Choose how the app responds to motion and contrast."
                />
              </p>
              {v2Mode && appearance ? (
                <form
                  action={updateAccessibilityAction}
                  className="stack-form settings-accessibility-form"
                >
                  <fieldset>
                    <legend>
                      <UiCopy pt="Movimento" en="Motion" />
                    </legend>
                    <label>
                      <input
                        type="radio"
                        name="motion"
                        value="system"
                        defaultChecked={appearance.motion === "system"}
                      />{" "}
                      <UiCopy
                        pt="Respeitar preferência do sistema"
                        en="Follow system preference"
                      />
                    </label>
                    <label>
                      <input
                        type="radio"
                        name="motion"
                        value="reduce"
                        defaultChecked={appearance.motion === "reduce"}
                      />{" "}
                      <UiCopy pt="Reduzir movimento" en="Reduce motion" />
                    </label>
                  </fieldset>
                  <fieldset>
                    <legend>
                      <UiCopy pt="Contraste" en="Contrast" />
                    </legend>
                    <label>
                      <input
                        type="radio"
                        name="contrast"
                        value="system"
                        defaultChecked={appearance.contrast === "system"}
                      />{" "}
                      <UiCopy
                        pt="Respeitar preferência do sistema"
                        en="Follow system preference"
                      />
                    </label>
                    <label>
                      <input
                        type="radio"
                        name="contrast"
                        value="high"
                        defaultChecked={appearance.contrast === "high"}
                      />{" "}
                      <UiCopy pt="Contraste alto" en="High contrast" />
                    </label>
                  </fieldset>
                  <button>
                    <UiCopy
                      pt="Salvar acessibilidade"
                      en="Save accessibility"
                    />
                  </button>
                </form>
              ) : null}
              <p>
                <UiCopy
                  pt="Tab percorre os controles. Escape fecha painéis e menus."
                  en="Tab moves through controls. Escape closes panels and menus."
                />
              </p>
            </section>
          ) : null}
          {section === "help" ? (
            <section
              className="config-panel settings-pane settings-help-pane"
              aria-labelledby="help-title"
            >
              <div className="section-heading">
                <span className="panel-index">05</span>
                <h2 id="help-title">
                  <UiCopy pt="Ajuda e Tutoriais" en="Help and Tutorials" />
                </h2>
              </div>
              <div className="settings-pane-intro">
                <span className="page-kicker">
                  <UiCopy pt="POR ONDE COMEÇAR" en="WHERE TO START" />
                </span>
                <h3>
                  <UiCopy
                    pt="Encontre seu caminho no OpenStudyHub."
                    en="Find your way around OpenStudyHub."
                  />
                </h3>
                <p>
                  <UiCopy
                    pt="Revise os primeiros passos ou vá direto ao ajuste de que precisa."
                    en="Review the first steps or go straight to the setting you need."
                  />
                </p>
              </div>
              <div className="settings-guide-grid">
                <Link href="/onboarding?replay=1">
                  <span aria-hidden="true">01</span>
                  <strong>
                    <UiCopy pt="Primeiros passos" en="Getting started" />
                  </strong>
                  <p>
                    <UiCopy
                      pt="Reveja perfil e disciplinas e conheça os visuais. A aparência pode ser alterada aqui em Configurações."
                      en="Review your profile and subjects and explore the themes. You can change appearance here in Settings."
                    />
                  </p>
                  <b>
                    <UiCopy pt="Rever guia →" en="Review guide →" />
                  </b>
                </Link>
                <Link href="/">
                  <span aria-hidden="true">02</span>
                  <strong>
                    <UiCopy pt="Personalizar a Home" en="Customize Home" />
                  </strong>
                  <p>
                    <UiCopy
                      pt="Use o lápis da Home para escolher fundo, atalhos e widgets."
                      en="Use the Home pencil to choose background, shortcuts and widgets."
                    />
                  </p>
                  <b>
                    <UiCopy pt="Abrir Home →" en="Open Home →" />
                  </b>
                </Link>
                <Link href="/google">
                  <span aria-hidden="true">03</span>
                  <strong>Google Classroom</strong>
                  <p>
                    <UiCopy
                      pt="Conecte sua conta e confirme as disciplinas antes de sincronizar."
                      en="Connect your account and confirm subjects before syncing."
                    />
                  </p>
                  <b>
                    <UiCopy pt="Configurar →" en="Configure →" />
                  </b>
                </Link>
              </div>
              {v2Mode ? (
                <section className="settings-account-control">
                  <h3>
                    <UiCopy pt="Conta" en="Account" />
                  </h3>
                  <p>
                    <UiCopy
                      pt="Desativar sua conta encerra as sessões e impede novos acessos. Registros acadêmicos e históricos protegidos podem permanecer conforme as regras da instituição."
                      en="Deactivating your account ends sessions and blocks new sign-ins. Protected academic records and history may remain under your institution's rules."
                    />
                  </p>
                  <details>
                    <summary>
                      <UiCopy
                        pt="Desativar minha conta"
                        en="Deactivate my account"
                      />
                    </summary>
                    <form
                      action={deactivateOwnV2AccountAction}
                      className="stack-form"
                    >
                      <label>
                        <UiCopy
                          pt="Digite seu login ("
                          en="Enter your username ("
                        />
                        {user.login}
                        <UiCopy pt=") para confirmar" en=" ) to confirm" />
                        <input
                          name="confirmation"
                          required
                          autoComplete="off"
                        />
                      </label>
                      <button type="submit" className="danger-button">
                        <UiCopy
                          pt="Desativar e sair"
                          en="Deactivate and sign out"
                        />
                      </button>
                    </form>
                  </details>
                </section>
              ) : null}
            </section>
          ) : null}
          {section === "about" ? (
            <section
              className="config-panel settings-pane settings-about-pane"
              aria-labelledby="about-title"
            >
              <div className="section-heading">
                <span className="panel-index">06</span>
                <h2 id="about-title">
                  <UiCopy pt="Sobre" en="About" />
                </h2>
              </div>
              <div className="settings-about-identity">
                <span className="page-kicker">
                  <UiCopy pt="SEU ESPAÇO DE ESTUDO" en="YOUR STUDY SPACE" />
                </span>
                <strong>OpenStudyHub</strong>
                <p>
                  <UiCopy
                    pt="Disciplinas, notas e projetos reunidos para acompanhar sua jornada acadêmica."
                    en="Subjects, notes and projects together to support your academic journey."
                  />
                </p>
              </div>
              <dl className="settings-about-facts">
                <div>
                  <dt>
                    <UiCopy pt="Versão" en="Version" />
                  </dt>
                  <dd>{packageMetadata.version}</dd>
                </div>
                <div>
                  <dt>
                    <UiCopy pt="Licença" en="License" />
                  </dt>
                  <dd>{packageMetadata.license}</dd>
                </div>
              </dl>
              <details>
                <summary>
                  <UiCopy
                    pt="Software de terceiros"
                    en="Third-party software"
                  />
                </summary>
                <p>
                  <UiCopy
                    pt="Quadro Branco baseado em"
                    en="Whiteboard based on"
                  />{" "}
                  <a
                    href="https://github.com/excalidraw/excalidraw"
                    target="_blank"
                    rel="noreferrer"
                  >
                    Excalidraw
                  </a>
                  <UiCopy
                    pt=", licenciado sob MIT."
                    en=", licensed under MIT."
                  />{" "}
                  <a
                    href="https://github.com/excalidraw/excalidraw/blob/v0.18.1/LICENSE"
                    target="_blank"
                    rel="noreferrer"
                  >
                    <UiCopy
                      pt="Ler licença e créditos ↗"
                      en="Read license and credits ↗"
                    />
                  </a>
                </p>
              </details>
              <div className="settings-about-links">
                <a
                  href="https://github.com/RichardSpinola/OpenStudyHub"
                  target="_blank"
                  rel="noreferrer"
                >
                  <UiCopy pt="Projeto no GitHub ↗" en="Project on GitHub ↗" />
                </a>
                <a
                  href="https://github.com/RichardSpinola/OpenStudyHub/releases"
                  target="_blank"
                  rel="noreferrer"
                >
                  <UiCopy pt="Notas de versão ↗" en="Release notes ↗" />
                </a>
              </div>
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
                <h2 id="administration-title">
                  <UiCopy pt="Administração" en="Administration" />
                </h2>
              </div>
              <div className="admin-settings-links">
                <Link href="/admin/users">
                  <strong>
                    <UiCopy pt="Usuários" en="Users" />
                  </strong>
                  <span>
                    <UiCopy
                      pt="Contas, matrículas, permissões e Visual Tags"
                      en="Accounts, enrollments, permissions and Visual Tags"
                    />
                  </span>
                </Link>
                <Link href="/admin/academic">
                  <strong>
                    <UiCopy pt="Acadêmico" en="Academic" />
                  </strong>
                  <span>
                    <UiCopy
                      pt="Programas, turmas, disciplinas e integrações"
                      en="Programs, cohorts, subjects and integrations"
                    />
                  </span>
                </Link>
                <Link href="/admin/academic?section=integrations">
                  <strong>
                    <UiCopy pt="Integrações" en="Integrations" />
                  </strong>
                  <span>
                    <UiCopy
                      pt="Drive, Classroom e Notebook por oferta"
                      en="Drive, Classroom and Notebook by offering"
                    />
                  </span>
                </Link>
                {user.role === "admin" ? (
                  <>
                    <Link href="/admin/audit">
                      <strong>
                        <UiCopy pt="Auditoria" en="Audit" />
                      </strong>
                      <span>
                        <UiCopy
                          pt="Eventos administrativos recentes"
                          en="Recent administrative events"
                        />
                      </span>
                    </Link>
                    <Link href="/settings?section=storage">
                      <strong>
                        <UiCopy pt="Armazenamento" en="Storage" />
                      </strong>
                      <span>
                        <UiCopy
                          pt="Layout lazy de pastas no Drive"
                          en="On-demand Drive folder layout"
                        />
                      </span>
                    </Link>
                    <Link href="/settings?section=instance">
                      <strong>
                        <UiCopy pt="Instância" en="Instance" />
                      </strong>
                      <span>
                        <UiCopy
                          pt="Identidade e defaults públicos"
                          en="Identity and public defaults"
                        />
                      </span>
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
                <h2 id="storage-title">
                  <UiCopy pt="Armazenamento" en="Storage" />
                </h2>
              </div>
              <form
                className="stack-form"
                action={updateDriveStorageOwnerAction}
              >
                <h3>
                  <UiCopy
                    pt="Drive central da instância"
                    en="Instance central Drive"
                  />
                </h3>
                <p className="panel-help">
                  <UiCopy
                    pt="A conta escolhida controla pastas acadêmicas, templates e documentos novos. Classroom continua usando a conexão de cada usuário."
                    en="The chosen account controls academic folders, templates and new documents. Classroom continues to use each user's connection."
                  />
                </p>
                <label>
                  <UiCopy pt="Conta de armazenamento" en="Storage account" />
                  <select
                    key={configuredStorageOwnerId ?? "legacy"}
                    name="storageOwnerUserId"
                    defaultValue={configuredStorageOwnerId ?? ""}
                  >
                    <option value="">
                      <UiCopy pt="Pessoal / legado" en="Personal / legacy" />
                    </option>
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
                    <UiCopy
                      pt="A conta central configurada não está disponível. Operações de escrita no Drive central permanecem bloqueadas até a configuração ser corrigida."
                      en="The configured central account is unavailable. Writes to central Drive remain blocked until the configuration is fixed."
                    />
                  </p>
                ) : null}
                <PendingSubmitButton
                  pendingLabel={tr(
                    "Salvando Drive central…",
                    "Saving central Drive…",
                  )}
                >
                  <UiCopy pt="Salvar Drive central" en="Save central Drive" />
                </PendingSubmitButton>
              </form>
              <form className="stack-form" action={updateStorageLayoutAction}>
                <p className="panel-help">
                  <UiCopy
                    pt="Define nomes futuros. Alterar este layout não move pastas já criadas no Drive."
                    en="Sets future names. Changing this layout does not move folders already created in Drive."
                  />
                </p>
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    name="includeCohort"
                    value="true"
                    defaultChecked={storageLayout.includeCohort}
                  />
                  <UiCopy
                    pt="Incluir turma quando estiver disponível"
                    en="Include cohort when available"
                  />
                </label>
                <details className="advanced-settings">
                  <summary>
                    <UiCopy pt="Padrões de nomes" en="Naming patterns" />
                  </summary>
                  <div className="stack-form">
                    <label>
                      <UiCopy pt="Programa" en="Program" />
                      <input
                        name="programPattern"
                        defaultValue={storageLayout.patterns.program}
                        required
                      />
                    </label>
                    <label>
                      <UiCopy pt="Turma" en="Cohort" />
                      <input
                        name="cohortPattern"
                        defaultValue={storageLayout.patterns.cohort}
                        required
                      />
                    </label>
                    <label>
                      <UiCopy pt="Período" en="Period" />
                      <input
                        name="periodPattern"
                        defaultValue={storageLayout.patterns.period}
                        required
                      />
                    </label>
                    <label>
                      <UiCopy pt="Disciplina" en="Subject" />
                      <input
                        name="subjectPattern"
                        defaultValue={storageLayout.patterns.subject}
                        required
                      />
                    </label>
                  </div>
                </details>
                <fieldset className="storage-categories">
                  <legend>
                    <UiCopy pt="Categorias" en="Categories" />
                  </legend>
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
                <button type="submit">
                  <UiCopy pt="Salvar organização" en="Save organization" />
                </button>
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
                  <strong>
                    <UiCopy pt="Recursos da instância" en="Instance features" />
                  </strong>
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      name="projectsEnabled"
                      value="true"
                      defaultChecked={projectsEnabled}
                    />
                    <UiCopy
                      pt="Mostrar Projetos nas disciplinas"
                      en="Show Projects in subjects"
                    />
                  </label>
                  <div className="form-actions">
                    <span>
                      <UiCopy
                        pt="Desativar oculta a UI sem apagar projetos ou versões existentes."
                        en="Disabling hides the UI without deleting existing projects or versions."
                      />
                    </span>
                    <button type="submit">
                      <UiCopy pt="Salvar recursos" en="Save features" />
                    </button>
                  </div>
                </form>

                <section className="stack-form institution-form external-links-settings">
                  <div>
                    <strong>
                      <UiCopy pt="Links externos" en="External links" />
                    </strong>
                    <p>
                      <UiCopy
                        pt="Atalhos compartilhados no rodapé da instância, como documentação, Drive acadêmico ou portal institucional."
                        en="Shared links in the instance footer, such as documentation, academic Drive or the institution portal."
                      />
                    </p>
                  </div>
                  <form
                    className="external-link-create"
                    action={addExternalLinkAction}
                  >
                    <label htmlFor="external-link-label">
                      <UiCopy pt="Nome" en="Name" />
                    </label>
                    <input
                      id="external-link-label"
                      name="label"
                      type="text"
                      maxLength={80}
                      placeholder={tr("Documentação", "Documentation")}
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
                      <UiCopy pt="Abrir em nova aba" en="Open in new tab" />
                    </label>
                    <button type="submit">
                      <UiCopy pt="Adicionar link" en="Add link" />
                    </button>
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
                            <button type="submit">
                              <UiCopy pt="Remover" en="Remove" />
                            </button>
                          </form>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <small>
                      <UiCopy
                        pt="Nenhum link externo configurado."
                        en="No external links configured."
                      />
                    </small>
                  )}
                  <small>
                    <UiCopy
                      pt="HTTPS em produção; localhost HTTP apenas em desenvolvimento."
                      en="Use HTTPS in production; localhost HTTP is for development only."
                    />
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
