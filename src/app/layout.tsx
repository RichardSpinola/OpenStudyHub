import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";

import { logoutAction } from "@/app/auth-actions";
import { PrimaryNavigation } from "@/components/primary-navigation";
import { NotificationCenter } from "@/components/notification-center";
import { V2ManagementLink } from "@/components/v2-management-link";
import { ExternalLinksMenu } from "@/components/external-links-menu";
import { UiLanguageProvider } from "@/components/ui-language-provider";
import { getServerEnvironment } from "@/lib/env";
import { getTranslations } from "@/lib/translations";
import { defaultUiLanguage, getUiLanguage } from "@/lib/ui-language";
import { getCurrentSession } from "@/lib/authorization";
import { getUserProfile } from "@/lib/profile";
import { listExternalLinks } from "@/lib/external-links";
import { getInstitutionName } from "@/lib/institution";

import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(getServerEnvironment().APP_URL),
  title: {
    default: "OpenStudyHub",
    template: "%s · OpenStudyHub",
  },
  applicationName: "OpenStudyHub",
  description:
    "Workspace acadêmico self-hosted para estudos, Google Classroom, Drive, notas, documentos e colaboração.",
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
  const environment = getServerEnvironment();
  const environmentLabel = environment.NODE_ENV ?? "local";
  const session = await getCurrentSession();
  let language = defaultUiLanguage;
  let theme: "dark" | "light" = "dark";

  try {
    if (session) {
      const profile = getUserProfile(session.user.id);
      language = profile.locale;
      theme = profile.theme;
    } else {
      language = getUiLanguage();
    }
  } catch {
    // The public shell must still render before the first migration.
  }
  const { shell } = getTranslations(language);
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
    <html lang={language} data-theme={theme}>
      <body>
        <a className="skip-link" href="#main-content">
          {shell.skipContent}
        </a>
        <UiLanguageProvider language={language}>
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
              {environment.NODE_ENV !== "production" ? (
                <span
                  className="environment"
                  aria-label={shell.currentEnvironment}
                >
                  SYS:{environmentLabel}
                </span>
              ) : null}
            </header>
            <main className="app-content" id="main-content">
              {children}
            </main>
            <footer className="app-footer">
              <PrimaryNavigation authenticated={session !== null} />
              <div className="session-status">
                <ExternalLinksMenu links={externalLinks} />
                <V2ManagementLink />
                {session ? (
                  <>
                    <NotificationCenter />
                    <Link
                      className="status"
                      href={`/profile/${session.user.id}`}
                    >
                      {session.user.displayName}
                    </Link>
                    <form action={logoutAction}>
                      <button type="submit">
                        {getTranslations(language).access.logout}
                      </button>
                    </form>
                  </>
                ) : null}
                <span className="status">
                  <span className="status-dot" aria-hidden="true" /> SELF-HOSTED
                </span>
              </div>
            </footer>
          </div>
        </UiLanguageProvider>
      </body>
    </html>
  );
}
