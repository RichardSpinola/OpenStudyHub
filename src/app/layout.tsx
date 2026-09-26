import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { headers } from "next/headers";

import { PrimaryNavigation } from "@/components/primary-navigation";
import { NotificationCenter } from "@/components/notification-center";
import { GoogleConnectionNotice } from "@/components/google-connection-notice";
import { V2ManagementLink } from "@/components/v2-management-link";
import { AccountMenu } from "@/components/account-menu";
import { ExternalLinksMenu } from "@/components/external-links-menu";
import { RealtimeBridge } from "@/components/realtime-bridge";
import { UiLanguageProvider } from "@/components/ui-language-provider";
import { getServerEnvironment } from "@/lib/env";
import { getTranslations } from "@/lib/translations";
import { defaultUiLanguage, getUiLanguage } from "@/lib/ui-language";
import { getCurrentSession } from "@/lib/authorization";
import { getUserProfile } from "@/lib/profile";
import { listExternalLinks } from "@/lib/external-links";
import { getInstitutionName } from "@/lib/institution";
import { getAppearance, defaultAppearance } from "@/lib/appearance";
import { accessibleAccent } from "@/lib/appearance-color";
import { isProjectsFeatureEnabled } from "@/lib/feature-flags";
import { getExtrasFlags } from "@/lib/v2/extras";
import { withV2Db } from "@/lib/v2/runtime";

import "./globals.css";
import "./phase4a.css";
import "./visual-review.css";
import "./phase6.css";
import "./phase10.css";

export const metadata: Metadata = {
  metadataBase: new URL(getServerEnvironment().APP_URL),
  title: {
    default: "OpenStudyHub",
    template: "%s · OpenStudyHub",
  },
  applicationName: "OpenStudyHub",
  description:
    "Workspace acadêmico para estudos, Google Classroom, Drive, notas, documentos e colaboração.",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: "/brand/icon-32.png",
    apple: "/brand/icon-180.png",
  },
};

export default async function RootLayout({
  children,
}: {
  children: ReactNode;
}) {
  const administrative =
    (await headers()).get("x-openstudyhub-surface") === "admin";
  if (administrative) {
    let adminLanguage = defaultUiLanguage;
    try {
      adminLanguage = getUiLanguage();
    } catch {
      // Setup can render before the V1 settings table exists.
    }
    return (
      <html lang={adminLanguage} data-theme="dark" data-design="material">
        <body className="admin-body">
          <UiLanguageProvider language={adminLanguage}>
            <a className="skip-link" href="#main-content">
              {getTranslations(adminLanguage).shell.skipContent}
            </a>
            <main id="main-content">{children}</main>
          </UiLanguageProvider>
        </body>
      </html>
    );
  }
  const environment = getServerEnvironment();
  const session = await getCurrentSession();
  let language = defaultUiLanguage;
  let theme: "dark" | "light" = "dark";
  let appearance = defaultAppearance;
  let projectsEnabled = false;
  let extrasEnabled = false;
  let hasAvatar = false;

  try {
    if (session) {
      const profile = getUserProfile(session.user.id);
      hasAvatar = Boolean(profile.avatarStorageName);
      language = profile.locale;
      theme = profile.theme;
      appearance = getAppearance(session.user.id);
      projectsEnabled = isProjectsFeatureEnabled();
      if (process.env.OPENSTUDYHUB_V2_ENABLED === "1")
        extrasEnabled = withV2Db((db) => getExtrasFlags(db).extras);
    } else {
      language = getUiLanguage();
    }
  } catch {
    // The public shell must still render before the first migration.
  }
  const { shell } = getTranslations(language);
  const classicNavigation =
    session && appearance.navigationLayout === "classic";
  const customAccentStyle =
    session && appearance.accent === "custom"
      ? ({
          "--custom-accent-dark": accessibleAccent(
            appearance.customAccent,
            "dark",
          ),
          "--custom-accent-light": accessibleAccent(
            appearance.customAccent,
            "light",
          ),
        } as React.CSSProperties)
      : undefined;
  let externalLinks = [] as ReturnType<typeof listExternalLinks>;
  let institutionName = "";
  try {
    if (session) externalLinks = listExternalLinks();
    institutionName = getInstitutionName();
  } catch {
    externalLinks = [];
    institutionName = "";
  }

  return (
    <html
      lang={language}
      data-theme={session ? appearance.mode : theme}
      data-design={
        session
          ? appearance.theme
          : process.env.OPENSTUDYHUB_V2_ENABLED === "1"
            ? "material"
            : undefined
      }
      data-density={session ? appearance.density : "comfortable"}
      data-accent={session ? appearance.accent : "neutral"}
      data-nav-layout={session ? appearance.navigationLayout : "top"}
      data-motion={session ? appearance.motion : "system"}
      data-contrast={session ? appearance.contrast : "system"}
      style={customAccentStyle}
    >
      <body>
        <a className="skip-link" href="#main-content">
          {shell.skipContent}
        </a>
        <UiLanguageProvider language={language}>
          {session && process.env.OPENSTUDYHUB_V2_ENABLED === "1" ? (
            <RealtimeBridge />
          ) : null}
          <div className="app-frame">
            <header className="app-header">
              <Link className="brand" href="/">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  className="brand-icon"
                  src="/brand/icon-32.png"
                  alt=""
                  width="20"
                  height="20"
                />
                <span className="brand-app-name">{environment.APP_NAME}</span>
                {institutionName ? (
                  <span className="brand-institution">
                    <span aria-hidden="true">/</span> {institutionName}
                  </span>
                ) : null}
              </Link>
              {!classicNavigation ? (
                <PrimaryNavigation
                  authenticated={session !== null}
                  projectsEnabled={projectsEnabled}
                  extrasEnabled={extrasEnabled}
                />
              ) : null}
              {session && !classicNavigation ? (
                <div className="shell-utilities">
                  <ExternalLinksMenu links={externalLinks} />
                  <NotificationCenter />
                  <AccountMenu
                    userId={session.user.id}
                    name={session.user.displayName}
                    hasAvatar={hasAvatar}
                    logoutLabel={getTranslations(language).access.logout}
                    managementLink={<V2ManagementLink />}
                  />
                </div>
              ) : null}
            </header>
            {session && process.env.OPENSTUDYHUB_V2_ENABLED === "1" ? (
              <GoogleConnectionNotice />
            ) : null}
            <main className="app-content" id="main-content">
              {children}
            </main>
            {classicNavigation ? (
              <footer className="app-footer classic-navigation-bar">
                <PrimaryNavigation
                  authenticated
                  projectsEnabled={projectsEnabled}
                  extrasEnabled={extrasEnabled}
                />
                <div className="classic-footer-utilities">
                  <ExternalLinksMenu links={externalLinks} />
                  <NotificationCenter />
                  <AccountMenu
                    userId={session.user.id}
                    name={session.user.displayName}
                    hasAvatar={hasAvatar}
                    logoutLabel={getTranslations(language).access.logout}
                    managementLink={<V2ManagementLink />}
                  />
                </div>
              </footer>
            ) : null}
          </div>
        </UiLanguageProvider>
      </body>
    </html>
  );
}
