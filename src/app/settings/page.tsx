import { searchUsesSameTab } from "@/lib/search-preferences";
import { TourLauncher } from "@/components/product-tour";
import Image from "next/image";
import { SettingsGroup, SettingsRow } from "@/components/settings-group";
import { SettingsShortcuts } from "@/components/settings-shortcuts";
import { HomePresentationControls } from "@/components/home-presentation-controls";
import {
  IconShieldLock,
  IconArrowRight,
  IconBook,
  IconBell,
  IconDeviceDesktop,
  IconBrandGoogleDrive,
  IconBrandGoogle,
  IconExternalLink,
  IconKeyboard,
} from "@tabler/icons-react";
import { SettingsPortal, settingsGroups } from "@/components/settings-portal";
import { SettingsForm } from "@/components/settings-form";
import { UiCopy } from "@/components/ui-language-provider";
import Link from "next/link";
import packageMetadata from "../../../package.json";

import { AsciiLogo } from "@/components/ascii-logo";
import { HomeBackgroundSettings } from "@/components/home-background-settings";
import { ClassroomSyncAll } from "@/components/classroom-sync-all";
import { ProfileLocaleSelect } from "@/components/profile-locale-select";
import { ProfileMediaSettings } from "@/components/profile-media-settings";
import { GameSoundSettings } from "@/components/game-sound-settings";
import { ThemeSelect } from "@/components/theme-select";
import { HomeControlSettings } from "@/components/home-control-settings";
import { getHomePresentation } from "@/lib/home-presentation";
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
  createShortcutAction,
  deleteShortcutAction,
  moveShortcutAction,
  toggleShortcutAction,
  updateIdentityAction,
  updateHomePreferencesAction,
  updateHomeSearchAction,
  deactivateOwnV2AccountAction,
  addExternalLinkAction,
  deleteExternalLinkAction,
  updateInstitutionAction,
  updateLanguageAction,
  updateProfileAction,
  updateLocaleSelectionAction,
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
  const homePresentation = v2Mode ? getHomePresentation(user.id) : null;
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

  const selectedGroup = settingsGroups.find(
    ([key]) => key === (section === "privacy" ? "profile" : section),
  );
  const SectionIcon = selectedGroup?.[1] ?? IconShieldLock;

  return (
    <div
      className="settings-shell settings-v7"
      data-settings-section={section}
      data-tour="settings-section"
    >
      <header className="settings-detail-header">
        {section !== "portal" ? (
          <Link className="settings-back" href="/settings">
            <UiCopy pt="← Configurações" en="← Settings" />
          </Link>
        ) : null}
        <div className="settings-title-row">
          {selectedGroup ? (
            <span className="settings-title-icon" aria-hidden="true">
              <SectionIcon size={30} stroke={1.5} />
            </span>
          ) : null}
          <div>
            <p className="system-label">
              <UiCopy pt="SUAS PREFERÊNCIAS" en="YOUR PREFERENCES" />
            </p>
            <h1>
              {selectedGroup
                ? tr(selectedGroup[2], selectedGroup[3])
                : tr("Configurações", "Settings")}
            </h1>
            <p className="page-description">
              {selectedGroup
                ? tr(selectedGroup[4], selectedGroup[5])
                : tr(
                    "Escolha uma área para personalizar seu espaço.",
                    "Choose an area to personalize your workspace.",
                  )}
            </p>
          </div>
        </div>
      </header>
      {section === "portal" ? <SettingsPortal /> : null}
      {!v2Mode && section === "portal" && canAdminister ? (
        <Link className="settings-back" href="/settings?section=administration">
          <UiCopy pt="Administração" en="Administration" />
        </Link>
      ) : null}

      {!data.available ? (
        <section className="config-panel" role="alert">
          <h2>{settings.databaseUnavailable}</h2>
          <p>{settings.checkMigrations}</p>
        </section>
      ) : (
        <>
          {section === "profile" ? (
            <div className="settings-detail-stack">
              <SettingsGroup
                title={tr("Foto e capa", "Photo and cover")}
                description={tr(
                  "Escolha uma imagem e ajuste o enquadramento antes de salvar.",
                  "Choose an image and adjust its framing before saving.",
                )}
              >
                <ProfileMediaSettings
                  userId={data.profile.id}
                  hasAvatar={Boolean(data.profile.avatarStorageName)}
                  hasBanner={Boolean(data.profile.bannerStorageName)}
                />
              </SettingsGroup>
              <div className="settings-content-columns">
                <SettingsGroup
                  title={tr("Como você aparece", "How you appear")}
                  description={tr(
                    "Estas informações aparecem no seu perfil para outras pessoas da instância.",
                    "These details appear on your profile to other people in the instance.",
                  )}
                >
                  <SettingsForm
                    action={updateProfileAction}
                    className="stack-form settings-profile-form"
                  >
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
                    <input
                      type="hidden"
                      name="locale"
                      value={data.profile.locale}
                    />
                    <label htmlFor="profile-bio">
                      {tr("Sobre você", "About you")}
                    </label>
                    <textarea
                      id="profile-bio"
                      name="bio"
                      maxLength={500}
                      defaultValue={data.profile.bio}
                      rows={4}
                      placeholder={tr(
                        "O que você estuda ou gostaria de compartilhar?",
                        "What do you study or want to share?",
                      )}
                    />
                    <small className="settings-note">
                      {tr(
                        "Até 500 caracteres. O idioma da interface fica em Acessibilidade e idioma.",
                        "Up to 500 characters. Interface language is under Accessibility and language.",
                      )}
                    </small>
                    <div className="form-actions">
                      <button type="submit">{settings.saveProfile}</button>
                      <Link href={`/profile/${user.id}`}>
                        {tr("Ver meu perfil", "View my profile")}{" "}
                        <IconExternalLink size={16} />
                      </Link>
                    </div>
                  </SettingsForm>
                </SettingsGroup>
                <SettingsGroup
                  title={tr("Sua conta", "Your account")}
                  className="settings-account-summary"
                >
                  <div className="settings-account-avatar" aria-hidden="true">
                    {data.profile.displayName.slice(0, 1).toUpperCase()}
                  </div>
                  <strong>{data.profile.displayName}</strong>
                  <span>@{user.login}</span>
                  <p className="settings-note">
                    {tr(
                      "Seu login identifica a conta. Alterar o nome de exibição não muda o acesso.",
                      "Your username identifies the account. Changing your display name does not change sign-in.",
                    )}
                  </p>
                  <Link
                    className="settings-related-link"
                    href="/settings?section=accessibility"
                  >
                    {tr(
                      "Idioma e acessibilidade",
                      "Language and accessibility",
                    )}{" "}
                    <IconArrowRight size={17} />
                  </Link>
                </SettingsGroup>
              </div>
              {data.profileTags.length ? (
                <SettingsGroup
                  title={tr("Identificações do perfil", "Profile badges")}
                  description={tr(
                    "Algumas identificações são definidas pela instituição; outras você pode mostrar ou remover.",
                    "Some badges are set by your institution; others can be added or removed by you.",
                  )}
                >
                  <div className="profile-tag-settings">
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
                          {!tag.selfAssignable
                            ? tr(
                                "Definida pela instituição",
                                "Set by institution",
                              )
                            : tag.assigned
                              ? tr("Remover", "Remove")
                              : tr("Adicionar", "Add")}
                        </button>
                      </form>
                    ))}
                  </div>
                </SettingsGroup>
              ) : null}
            </div>
          ) : null}

          {section === "profile" || section === "privacy" ? (
            <SettingsGroup
              title={tr("Privacidade e acesso", "Privacy and access")}
              description={tr(
                "Revise suas conexões e as opções de acesso da sua conta.",
                "Review your connections and account access options.",
              )}
            >
              <div className="settings-related-grid">
                <Link
                  className="settings-related-link"
                  href="/settings?section=google"
                >
                  <IconShieldLock size={21} />
                  <span>
                    {tr(
                      "Revisar sua conexão Google",
                      "Review your Google connection",
                    )}
                  </span>
                  <IconArrowRight size={17} />
                </Link>
                <Link
                  className="settings-related-link"
                  href="/settings?section=notifications"
                >
                  <IconBell size={21} />
                  <span>
                    {tr(
                      "Escolher quais avisos receber",
                      "Choose which alerts to receive",
                    )}
                  </span>
                  <IconArrowRight size={17} />
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
            </SettingsGroup>
          ) : null}

          {section === "notifications" ? (
            <div className="settings-content-columns">
              <SettingsForm
                autoSave
                className="settings-detail-stack settings-notification-form"
                action={updateNotificationPreferencesAction}
              >
                <SettingsGroup
                  title={tr("Conversas", "Conversations")}
                  description={tr(
                    "Escolha o padrão de avisos para cada tipo de conversa.",
                    "Choose default alerts for each kind of conversation.",
                  )}
                >
                  {(
                    [
                      [
                        "dm",
                        "Mensagens diretas",
                        "Direct messages",
                        "Conversas entre você e outra pessoa.",
                        "Conversations between you and another person.",
                      ],
                      [
                        "groupDefault",
                        "Grupos",
                        "Groups",
                        "Padrão de avisos para seus grupos.",
                        "Default alerts for your groups.",
                      ],
                      [
                        "audienceDefault",
                        "Conversas da comunidade",
                        "Community conversations",
                        "Canais e audiências da sua instituição.",
                        "Your institution's channels and audiences.",
                      ],
                    ] as const
                  ).map(([name, pt, en, description, english]) => (
                    <SettingsRow
                      key={name}
                      title={tr(pt, en)}
                      description={tr(description, english)}
                    >
                      <select
                        name={name}
                        aria-label={tr(pt, en)}
                        defaultValue={data.notificationPreferences[name]}
                      >
                        <option value="all">
                          {tr("Todas as mensagens", "All messages")}
                        </option>
                        <option value="mentions">
                          {tr("Só menções", "Only mentions")}
                        </option>
                        <option value="none">{tr("Nenhuma", "None")}</option>
                      </select>
                    </SettingsRow>
                  ))}
                </SettingsGroup>
                <SettingsGroup
                  title={tr(
                    "Quando chamar sua atenção",
                    "When to get your attention",
                  )}
                >
                  <SettingsRow
                    title={tr(
                      "Quando mencionarem você",
                      "When you are mentioned",
                    )}
                    description={tr(
                      "Avisos quando alguém usar seu nome em uma conversa.",
                      "Alerts when someone mentions you in a conversation.",
                    )}
                  >
                    <CanonicalCheckbox
                      key={`mentions-${data.notificationPreferences.mentionsEnabled}`}
                      name="mentionsEnabled"
                      checked={data.notificationPreferences.mentionsEnabled}
                    />
                  </SettingsRow>
                  <SettingsRow
                    title={tr(
                      "Respostas às suas mensagens",
                      "Replies to your messages",
                    )}
                  >
                    <CanonicalCheckbox
                      key={`replies-${data.notificationPreferences.repliesEnabled}`}
                      name="repliesEnabled"
                      checked={data.notificationPreferences.repliesEnabled}
                    />
                  </SettingsRow>
                  <SettingsRow
                    title={tr(
                      "Avisos do sistema com o Hub aberto",
                      "System alerts while Hub is open",
                    )}
                    description={tr(
                      "Depende também da permissão do navegador.",
                      "Also depends on browser permission.",
                    )}
                  >
                    <CanonicalCheckbox
                      key={`desktop-${data.notificationPreferences.desktopEnabled}`}
                      name="desktopEnabled"
                      checked={data.notificationPreferences.desktopEnabled}
                    />
                  </SettingsRow>
                </SettingsGroup>
              </SettingsForm>
              <SettingsGroup
                title={tr("Neste dispositivo", "On this device")}
                description={tr(
                  "Receba avisos mesmo quando o Hub estiver fechado.",
                  "Receive alerts even when Hub is closed.",
                )}
                className="settings-device-card"
              >
                <div
                  className="settings-device-illustration"
                  aria-hidden="true"
                >
                  <IconDeviceDesktop size={64} stroke={1.2} />
                  <IconBell size={26} />
                </div>
                <PushControls />
                <div className="settings-tip">
                  <strong>
                    {tr(
                      "Não apareceu o pedido de permissão?",
                      "No permission prompt?",
                    )}
                  </strong>
                  <p>
                    {tr(
                      "Veja a permissão de notificações deste site no navegador. Se o envio não estiver configurado, o responsável da instância precisa ativá-lo.",
                      "Check this site's notification permission in your browser. If delivery is not configured, the instance administrator needs to enable it.",
                    )}
                  </p>
                </div>
              </SettingsGroup>
            </div>
          ) : null}

          {section === "personalization" ? (
            <div className="settings-detail-stack">
              {appearance ? (
                <AppearanceControls initial={appearance} />
              ) : (
                <SettingsGroup title={tr("Tema", "Theme")}>
                  <Link href="/settings?section=home">
                    {tr("Escolher tema da Home", "Choose Home theme")}
                  </Link>
                </SettingsGroup>
              )}
              <SettingsGroup
                title={tr("Sons e celebrações", "Sounds and celebrations")}
                description={tr(
                  "Um toque opcional nas vitórias, sem alterar o áudio do restante do site.",
                  "An optional sound for victories without changing audio elsewhere.",
                )}
              >
                <GameSoundSettings userId={user.id} />
              </SettingsGroup>
              <Link
                className="settings-related-link"
                href="/settings?section=accessibility"
              >
                <IconKeyboard size={21} />
                <span>
                  {tr(
                    "Redução de movimento e contraste",
                    "Reduced motion and contrast",
                  )}
                </span>
                <IconArrowRight size={17} />
              </Link>
            </div>
          ) : null}

          {section === "home" ? (
            <div className="settings-detail-stack">
              <SettingsGroup
                title={tr("Seu plano de fundo", "Your background")}
                description={tr(
                  "Escolha um dos fundos ou envie uma imagem. Você pode ajustar o enquadramento sem trocar o arquivo.",
                  "Choose a background or upload an image. You can adjust framing without replacing the file.",
                )}
              >
                <div className="settings-wallpaper-layout">
                  <HomeBackgroundSettings
                    configured={homeBackground !== null}
                    catalog={wallpaperCatalog}
                  />
                  {homePresentation && wallpaperCatalog ? (
                    <HomePresentationControls
                      initial={homePresentation}
                      catalog={wallpaperCatalog}
                    />
                  ) : null}
                </div>
              </SettingsGroup>
              <div className="settings-equal-columns">
                <SettingsGroup
                  title={tr("O que aparece na Home", "What appears on Home")}
                >
                  <SettingsForm
                    autoSave
                    className="settings-home-preferences"
                    action={updateHomePreferencesAction}
                  >
                    {v2Mode ? (
                      <input
                        type="hidden"
                        name="theme"
                        value={data.profile.theme}
                      />
                    ) : (
                      <label>
                        {tr("Tema", "Theme")}
                        <ThemeSelect defaultValue={data.profile.theme} />
                      </label>
                    )}
                    <SettingsRow
                      title={tr("Relógio", "Clock")}
                      description={tr(
                        "Hora e data na tela inicial.",
                        "Time and date on your home screen.",
                      )}
                    >
                      <CanonicalCheckbox
                        key={`clock-${data.profile.homeClockEnabled}`}
                        name="homeClockEnabled"
                        checked={data.profile.homeClockEnabled}
                      />
                    </SettingsRow>
                    <SettingsRow
                      title={tr("Posição do relógio", "Clock position")}
                    >
                      <CanonicalSelect
                        key={`position-${data.profile.homeClockPosition}`}
                        name="homeClockPosition"
                        value={data.profile.homeClockPosition}
                      >
                        <option value="top-left">
                          {tr("Superior esquerdo", "Top left")}
                        </option>
                        <option value="top-right">
                          {tr("Superior direito", "Top right")}
                        </option>
                        <option value="bottom-left">
                          {tr("Inferior esquerdo", "Bottom left")}
                        </option>
                        <option value="bottom-right">
                          {tr("Inferior direito", "Bottom right")}
                        </option>
                      </CanonicalSelect>
                    </SettingsRow>
                    <SettingsRow
                      title={tr("Resumo de Hoje", "Today summary")}
                      description={tr(
                        "Próxima aula, prazos e atualizações.",
                        "Next class, deadlines and updates.",
                      )}
                    >
                      <CanonicalCheckbox
                        key={`today-${data.profile.todayWidgetEnabled}`}
                        name="todayWidgetEnabled"
                        checked={data.profile.todayWidgetEnabled}
                      />
                    </SettingsRow>
                  </SettingsForm>
                  {homePresentation ? (
                    <HomeControlSettings
                      enabled={homePresentation.controlEnabled}
                    />
                  ) : null}
                </SettingsGroup>
                <SettingsGroup
                  title={tr("Sua pesquisa", "Your search")}
                  description={tr(
                    "O provedor usado ao pesquisar na Home ou em uma nova aba.",
                    "The provider used when searching on Home or a new tab.",
                  )}
                >
                  {v2Mode ? (
                    <SettingsForm
                      autoSave
                      className="stack-form"
                      action={updateHomeSearchAction}
                    >
                      <input
                        type="hidden"
                        name="searchPreferencePresent"
                        value="1"
                      />
                      <SettingsRow
                        title={tr("Pesquisar nesta aba", "Search in this tab")}
                        description={tr(
                          "Desative para abrir as pesquisas em outra aba. O botão do meio sempre abre outra aba.",
                          "Turn off to open searches in a new tab. Middle-click always opens a new tab.",
                        )}
                      >
                        <CanonicalCheckbox
                          key={`same-tab-${searchUsesSameTab(user.id)}`}
                          name="searchSameTab"
                          checked={searchUsesSameTab(user.id)}
                        />
                      </SettingsRow>
                      <label>
                        {tr("Pesquisar com", "Search with")}
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
                      <p className="settings-note">
                        {tr(
                          "O endereço e o termo da pesquisa são enviados ao provedor escolhido quando você pesquisa.",
                          "The search address and query are sent to your selected provider when you search.",
                        )}
                      </p>
                    </SettingsForm>
                  ) : null}
                  <Link className="settings-related-link" href="/">
                    {tr("Ver minha Home", "View my Home")}{" "}
                    <IconExternalLink size={17} />
                  </Link>
                </SettingsGroup>
              </div>
              <SettingsGroup
                title={tr("Seus atalhos", "Your shortcuts")}
                description={tr(
                  "Os mesmos links e o mesmo editor que você usa na Home.",
                  "The same links and editor you use on Home.",
                )}
              >
                <SettingsShortcuts items={data.personalShortcuts} />
              </SettingsGroup>
            </div>
          ) : null}

          {section === "google" ? (
            <div className="settings-detail-stack">
              {v2Mode ? (
                <div className="settings-content-columns">
                  <SettingsGroup
                    title="Google Classroom"
                    description={tr(
                      "Traga avisos, atividades e materiais das suas disciplinas.",
                      "Bring announcements, assignments and materials from your courses.",
                    )}
                  >
                    <div className="settings-integration-brand">
                      <IconBrandGoogle size={34} />
                      <span
                        className="settings-connection-badge"
                        data-connected={
                          googleHealth?.connection === "connected"
                        }
                      >
                        {googleHealth?.connection === "needs_reconnect"
                          ? tr("Reconectar", "Reconnect")
                          : googleHealth?.connection === "connected"
                            ? tr("Conectado", "Connected")
                            : tr("Não conectado", "Not connected")}
                      </span>
                    </div>
                    <p>
                      {googleHealth?.connection === "needs_reconnect"
                        ? tr(
                            "A autorização precisa ser renovada. As informações já salvas continuam aqui.",
                            "Authorization needs renewing. Your saved information remains here.",
                          )
                        : googleHealth?.connection === "connected"
                          ? tr(
                              "Sua conexão está disponível. Você pode revisar as disciplinas associadas e sincronizar as novidades.",
                              "Your connection is available. Review linked courses and sync updates.",
                            )
                          : tr(
                              "Conecte sua conta pessoal e escolha as disciplinas que correspondem aos seus Classrooms.",
                              "Connect your personal account and choose which subjects match your Classrooms.",
                            )}
                    </p>
                    {googleHealth?.result === "temporary_error" ? (
                      <p role="status" className="settings-tip">
                        {tr(
                          "A verificação está temporariamente indisponível. Tente novamente depois.",
                          "The check is temporarily unavailable. Try again later.",
                        )}
                      </p>
                    ) : null}
                    <Link className="settings-primary-link" href="/google">
                      {googleHealth?.connection === "connected"
                        ? tr(
                            "Gerenciar conexão e disciplinas",
                            "Manage connection and courses",
                          )
                        : tr(
                            "Configurar conexão Google",
                            "Set up Google connection",
                          )}
                      <IconArrowRight size={18} />
                    </Link>
                    <small className="settings-note">
                      {tr("Última verificação", "Last check")}:{" "}
                      {googleHealth?.checkedAt
                        ? new Intl.DateTimeFormat(language, {
                            dateStyle: "short",
                            timeStyle: "short",
                          }).format(googleHealth.checkedAt)
                        : tr("Ainda não realizada", "Not yet performed")}
                    </small>
                  </SettingsGroup>
                  <SettingsGroup
                    title={tr(
                      "Arquivos e Google Drive",
                      "Files and Google Drive",
                    )}
                    className="settings-integration-storage"
                  >
                    <IconBrandGoogleDrive size={38} stroke={1.3} />
                    <h3>
                      {tr("Armazenamento da instância", "Instance storage")}
                    </h3>
                    <p>
                      {tr(
                        "O responsável configura o Drive central. Sua conta pessoal do Classroom e o armazenamento da instância são conexões diferentes.",
                        "The administrator configures central Drive. Your personal Classroom account and instance storage are separate connections.",
                      )}
                    </p>
                    <p className="settings-tip">
                      {tr(
                        "Notas e arquivos locais continuam disponíveis sem Google. Arquivos remotos dependem da conexão do Drive.",
                        "Notes and local files stay available without Google. Remote files depend on the Drive connection.",
                      )}
                    </p>
                    <Link className="settings-related-link" href="/library">
                      {tr("Abrir Biblioteca", "Open Library")}{" "}
                      <IconArrowRight size={17} />
                    </Link>
                  </SettingsGroup>
                </div>
              ) : (
                <SettingsGroup title={settings.googleIntegration}>
                  {" "}
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
                            aria-label={tr(
                              "Recursos Google",
                              "Google features",
                            )}
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
                      {!googleAvailability.configured &&
                      user.role === "admin" ? (
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
                        <button type="submit">
                          {settings.googleDisconnect}
                        </button>
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
                </SettingsGroup>
              )}
            </div>
          ) : null}

          {section === "accessibility" ? (
            <div className="settings-detail-stack">
              {appearance ? (
                <AppearanceControls initial={appearance} accessibilityOnly />
              ) : null}
              <div className="settings-equal-columns">
                <SettingsGroup
                  title={tr("Idioma da interface", "Interface language")}
                  description={tr(
                    "Muda menus e avisos. Seus textos, mensagens e conteúdos não são traduzidos.",
                    "Changes menus and notices. Your texts, messages and content are not translated.",
                  )}
                >
                  <SettingsForm
                    action={updateLocaleSelectionAction}
                    autoSave
                    className="stack-form"
                  >
                    <ProfileLocaleSelect
                      label={settings.languageLabel}
                      locale={data.profile.locale}
                    />
                  </SettingsForm>
                </SettingsGroup>
                <SettingsGroup
                  title={tr("Navegação pelo teclado", "Keyboard navigation")}
                >
                  <div className="settings-keyboard-guide">
                    <p>
                      <kbd>Tab</kbd>
                      <span>
                        {tr("Percorrer os controles", "Move between controls")}
                      </span>
                    </p>
                    <p>
                      <kbd>Enter</kbd>
                      <span>{tr("Abrir ou confirmar", "Open or confirm")}</span>
                    </p>
                    <p>
                      <kbd>Esc</kbd>
                      <span>
                        {tr("Fechar menus e painéis", "Close menus and panels")}
                      </span>
                    </p>
                  </div>
                </SettingsGroup>
              </div>
            </div>
          ) : null}

          {section === "help" ? (
            <div className="settings-detail-stack">
              <SettingsGroup
                title={tr(
                  "O que você quer fazer?",
                  "What would you like to do?",
                )}
              >
                <TourLauncher />
                <div className="settings-help-grid">
                  {(
                    [
                      [
                        "/onboarding?replay=1",
                        "Primeiros passos",
                        "Getting started",
                        "Rever perfil e preferências do primeiro acesso.",
                        "Review initial profile and preferences.",
                      ],
                      [
                        "/settings?section=home",
                        "Personalizar a Home",
                        "Customize Home",
                        "Fundo, atalhos, relógio e pesquisa.",
                        "Background, shortcuts, clock and search.",
                      ],
                      [
                        "/notes",
                        "Organizar minhas notas",
                        "Organize my notes",
                        "Páginas, bases e imagens em um só lugar.",
                        "Pages, databases and images in one place.",
                      ],
                      [
                        "/google",
                        "Conectar o Classroom",
                        "Connect Classroom",
                        "Conexão, disciplinas e sincronização.",
                        "Connection, courses and syncing.",
                      ],
                    ] as const
                  ).map(([href, pt, en, description, english]) => (
                    <Link key={href} href={href}>
                      <IconBook size={25} stroke={1.5} />
                      <strong>{tr(pt, en)}</strong>
                      <p>{tr(description, english)}</p>
                      <span>
                        {tr("Abrir", "Open")} <IconArrowRight size={17} />
                      </span>
                    </Link>
                  ))}
                </div>
              </SettingsGroup>
              <SettingsGroup
                title={tr("Dúvidas frequentes", "Common questions")}
              >
                <div className="settings-faq">
                  <details>
                    <summary>
                      {tr(
                        "Preciso do Google para usar o Hub?",
                        "Do I need Google to use Hub?",
                      )}
                    </summary>
                    <p>
                      {tr(
                        "Você pode usar notas e arquivos locais sem Google. Classroom e arquivos remotos precisam das respectivas integrações.",
                        "You can use notes and local files without Google. Classroom and remote files need their respective integrations.",
                      )}
                    </p>
                  </details>
                  <details>
                    <summary>
                      {tr(
                        "Uma alteração não foi salva. E agora?",
                        "A change was not saved. What now?",
                      )}
                    </summary>
                    <p>
                      {tr(
                        "Confira sua conexão e o aviso junto ao controle. Tente salvar novamente. Nome e apresentação usam o botão Salvar perfil.",
                        "Check your connection and the notice next to the control. Try saving again. Name and bio use the Save profile button.",
                      )}
                    </p>
                  </details>
                  <details>
                    <summary>
                      {tr(
                        "Onde vejo licenças e créditos?",
                        "Where are licenses and credits?",
                      )}
                    </summary>
                    <p>
                      <Link href="/settings?section=about">
                        {tr("Sobre e Créditos", "About and Credits")}{" "}
                        <IconArrowRight size={16} />
                      </Link>
                    </p>
                  </details>
                </div>
              </SettingsGroup>
            </div>
          ) : null}

          {section === "about" ? (
            <div className="settings-detail-stack">
              <SettingsGroup
                title="OpenStudyHub"
                description={tr(
                  "Seu espaço para estudar, criar e compartilhar.",
                  "Your space to study, create and share.",
                )}
              >
                <div className="settings-about-brand">
                  <Image
                    src="/brand/icon-180.png"
                    width="72"
                    height="72"
                    alt=""
                  />
                  <div>
                    <strong>OpenStudyHub</strong>
                    <p>
                      {tr(
                        "Disciplinas, notas, documentos e projetos reunidos.",
                        "Subjects, notes, documents and projects together.",
                      )}
                    </p>
                  </div>
                </div>
                <dl className="settings-version-facts">
                  <div>
                    <dt>{tr("Versão", "Version")}</dt>
                    <dd>{packageMetadata.version}</dd>
                  </div>
                  <div>
                    <dt>{tr("Licença do projeto", "Project license")}</dt>
                    <dd>{packageMetadata.license}</dd>
                  </div>
                </dl>
                <div className="settings-related-grid">
                  <a
                    className="settings-related-link"
                    href="https://github.com/RichardSpinola/OpenStudyHub"
                    target="_blank"
                    rel="noreferrer"
                  >
                    {tr("Projeto no GitHub", "Project on GitHub")}{" "}
                    <IconExternalLink size={17} />
                  </a>
                  <a
                    className="settings-related-link"
                    href="https://github.com/RichardSpinola/OpenStudyHub/releases"
                    target="_blank"
                    rel="noreferrer"
                  >
                    {tr("Notas de versão", "Release notes")}{" "}
                    <IconExternalLink size={17} />
                  </a>
                </div>
              </SettingsGroup>
              <SettingsGroup
                title={tr("Créditos", "Credits")}
                description={tr(
                  "Software que ajuda a construir o OpenStudyHub.",
                  "Software that helps build OpenStudyHub.",
                )}
              >
                <div className="settings-credit-grid">
                  <article>
                    <span className="settings-credit-glyph" aria-hidden="true">
                      ✎
                    </span>
                    <h3>Excalidraw</h3>
                    <p>
                      {tr("Base do Quadro Branco", "Whiteboard foundation")}
                    </p>
                    <span>MIT</span>
                    <a
                      href="https://github.com/excalidraw/excalidraw/blob/v0.18.1/LICENSE"
                      target="_blank"
                      rel="noreferrer"
                    >
                      {tr("Licença e projeto", "License and project")}{" "}
                      <IconExternalLink size={15} />
                    </a>
                  </article>
                  <article>
                    <span className="settings-credit-glyph" aria-hidden="true">
                      ▤
                    </span>
                    <h3>BlockNote</h3>
                    <p>
                      {tr(
                        "Editor por blocos nas Notas",
                        "Block editor in Notes",
                      )}
                    </p>
                    <span>MPL-2.0</span>
                    <Link href="/credits">
                      {tr("Licença e créditos", "License and credits")}{" "}
                      <IconArrowRight size={15} />
                    </Link>
                  </article>
                  <article>
                    <span className="settings-credit-glyph" aria-hidden="true">
                      ⇄
                    </span>
                    <h3>Yjs</h3>
                    <p>
                      {tr(
                        "Edição colaborativa de notas",
                        "Collaborative note editing",
                      )}
                    </p>
                    <span>MIT</span>
                    <Link href="/credits">
                      {tr("Licença e créditos", "License and credits")}{" "}
                      <IconArrowRight size={15} />
                    </Link>
                  </article>
                </div>
                <Link className="settings-related-link" href="/credits">
                  {tr(
                    "Todos os créditos e avisos de terceiros",
                    "All credits and third-party notices",
                  )}{" "}
                  <IconArrowRight size={18} />
                </Link>
              </SettingsGroup>
            </div>
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
