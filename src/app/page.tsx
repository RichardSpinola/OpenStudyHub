import { AsciiLogo } from "@/components/ascii-logo";
import { HomeClock } from "@/components/home-clock";
import { SearchForm } from "@/components/search-form";
import { ShortcutGrid } from "@/components/shortcut-grid";
import {
  defaultBrandConfig,
  generateAsciiLogo,
  getAsciiLogo,
} from "@/lib/home-settings";
import type { Shortcut } from "@/lib/shortcuts";
import { requireAuthenticatedUser } from "@/lib/authorization";
import { getUserProfile } from "@/lib/profile";
import { getHomeBackground } from "@/lib/home-background";
import { getTranslations } from "@/lib/translations";
import { defaultUiLanguage, type UiLanguage } from "@/lib/ui-language";
import { listEnabledUserShortcuts } from "@/lib/user-shortcuts";
import { getTodayData, type TodayData } from "@/lib/today";
import { disableTodayWidgetAction } from "@/app/today/actions";
import Link from "next/link";
import type { CSSProperties } from "react";

export const dynamic = "force-dynamic";

type HomeData = {
  asciiLogo: string;
  shortcuts: Shortcut[];
  databaseAvailable: boolean;
  language: UiLanguage;
  today: TodayData | null;
  clock: {
    enabled: boolean;
    position: "top-left" | "top-right" | "bottom-left" | "bottom-right";
  };
  backgroundVersion: number | null;
};

function loadHomeData(userId: number): HomeData {
  try {
    const profile = getUserProfile(userId);
    return {
      asciiLogo: getAsciiLogo(),
      shortcuts: listEnabledUserShortcuts(userId),
      databaseAvailable: true,
      language: profile.locale,
      today: profile.todayWidgetEnabled ? getTodayData(userId) : null,
      clock: {
        enabled: profile.homeClockEnabled,
        position: profile.homeClockPosition,
      },
      backgroundVersion: getHomeBackground(userId)?.updatedAt ?? null,
    };
  } catch {
    return {
      asciiLogo: generateAsciiLogo(defaultBrandConfig),
      shortcuts: [],
      databaseAvailable: false,
      language: defaultUiLanguage,
      today: null,
      clock: { enabled: false, position: "top-right" },
      backgroundVersion: null,
    };
  }
}

export default async function HomePage() {
  const user = await requireAuthenticatedUser();
  const {
    asciiLogo,
    shortcuts,
    databaseAvailable,
    language,
    today,
    clock,
    backgroundVersion,
  } = loadHomeData(user.id);
  const translations = getTranslations(language);

  return (
    <div
      className="home-shell"
      data-has-background={backgroundVersion !== null}
      style={
        backgroundVersion
          ? ({
              "--home-background-image": `url(/api/home-background?v=${backgroundVersion})`,
            } as CSSProperties)
          : undefined
      }
    >
      <section className="home-hero" aria-labelledby="home-title">
        {clock.enabled ? (
          <HomeClock locale={language} position={clock.position} />
        ) : null}
        <Link
          className="home-edit-link"
          href="/settings?section=personalization"
        >
          [ editar ]
        </Link>
        <h1 id="home-title" className="sr-only">
          OpenStudyHub
        </h1>
        <AsciiLogo value={asciiLogo} />
        <SearchForm />

        <div className="shortcut-section">
          {!databaseAvailable ? (
            <div className="empty-state" role="status">
              <strong>{translations.states.unavailable}</strong>
              <span>{translations.settings.checkMigrations}</span>
            </div>
          ) : (
            <ShortcutGrid shortcuts={shortcuts} canManage />
          )}
        </div>
        {today ? (
          <aside
            className="home-today"
            aria-label={translations.academic.todayTitle}
          >
            <Link href="/today">
              {!clock.enabled ? (
                <span className="home-today-date">
                  {new Intl.DateTimeFormat(language, {
                    day: "2-digit",
                    month: "short",
                  })
                    .format(new Date())
                    .replace(".", "")
                    .toUpperCase()}
                </span>
              ) : null}
              <strong>{translations.academic.todayTitle}</strong>
              <span>{today.classes.length} aula(s)</span>
              <span>{today.activities.length} prazo(s) próximo(s)</span>
              <span className="home-today-open">Abrir Hoje →</span>
            </Link>
            <form action={disableTodayWidgetAction}>
              <button type="submit" aria-label="Ocultar Today">
                ×
              </button>
            </form>
          </aside>
        ) : null}
      </section>
    </div>
  );
}
