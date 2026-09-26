import { UiCopy } from "@/components/ui-language-provider";
import { AsciiLogo } from "@/components/ascii-logo";
import { HomeClock } from "@/components/home-clock";
import { HomeInteractions } from "@/components/home-interactions";
import {
  defaultBrandConfig,
  generateAsciiLogo,
  getBrandConfig,
} from "@/lib/home-settings";
import type { Shortcut } from "@/lib/shortcuts";
import { requireAuthenticatedUser } from "@/lib/authorization";
import { getUserProfile } from "@/lib/profile";
import { getHomeBackground } from "@/lib/home-background";
import {
  getWallpaperCatalog,
  type WallpaperCatalog,
} from "@/lib/home-wallpapers";
import {
  getAppearance,
  type Appearance,
  defaultAppearance,
} from "@/lib/appearance";
import { getTranslations, uiText } from "@/lib/translations";
import { defaultUiLanguage, type UiLanguage } from "@/lib/ui-language";
import { listUserShortcuts } from "@/lib/user-shortcuts";
import { getTodayData, type TodayData } from "@/lib/today";
import { selectTodayHighlights } from "@/lib/today-highlights";
import {
  getPersonalClassroomSummary,
  type PersonalClassroomSummary,
} from "@/lib/v2/classroom-ui";
import { formatMinutes } from "@/lib/academic-format";
import { disableTodayWidgetAction } from "@/app/today/actions";
import Link from "next/link";
import type { CSSProperties } from "react";

export const dynamic = "force-dynamic";

type HomeData = {
  asciiLogo: string;
  compactAsciiLogo: string;
  brandText: string;
  databaseAvailable: boolean;
  language: UiLanguage;
  today: TodayData | null;
  classroom: PersonalClassroomSummary | null;
  allShortcuts: Shortcut[];
  appearance: Appearance;
  theme: "dark" | "light";
  todayWidgetEnabled: boolean;
  catalog: WallpaperCatalog;
  clock: {
    enabled: boolean;
    position: "top-left" | "top-right" | "bottom-left" | "bottom-right";
  };
  backgroundVersion: number | null;
};

function loadHomeData(userId: number): HomeData {
  try {
    const brand = getBrandConfig();
    const profile = getUserProfile(userId);
    const allShortcuts = listUserShortcuts(userId);
    const background = getHomeBackground(userId);
    return {
      asciiLogo: generateAsciiLogo(brand),
      compactAsciiLogo: generateAsciiLogo({ ...brand, font: "Three Point" }),
      brandText: brand.text,
      allShortcuts,
      appearance: getAppearance(userId),
      theme: profile.theme,
      todayWidgetEnabled: profile.todayWidgetEnabled,
      catalog: getWallpaperCatalog(userId, background !== null),
      databaseAvailable: true,
      language: profile.locale,
      today: profile.todayWidgetEnabled ? getTodayData(userId) : null,
      classroom: getPersonalClassroomSummary(userId),
      clock: {
        enabled: profile.homeClockEnabled,
        position: profile.homeClockPosition,
      },
      backgroundVersion: background?.updatedAt ?? null,
    };
  } catch {
    return {
      asciiLogo: generateAsciiLogo(defaultBrandConfig),
      compactAsciiLogo: generateAsciiLogo({
        ...defaultBrandConfig,
        font: "Three Point",
      }),
      brandText: defaultBrandConfig.text,
      allShortcuts: [],
      appearance: defaultAppearance,
      theme: "dark",
      todayWidgetEnabled: false,
      catalog: { selected: "none", wallpapers: [] },
      databaseAvailable: false,
      language: defaultUiLanguage,
      today: null,
      classroom: null,
      clock: { enabled: false, position: "top-right" },
      backgroundVersion: null,
    };
  }
}

export default async function HomePage() {
  const user = await requireAuthenticatedUser();
  const {
    asciiLogo,
    compactAsciiLogo,
    brandText,
    databaseAvailable,
    language,
    today,
    classroom,
    allShortcuts,
    appearance,
    theme,
    todayWidgetEnabled,
    catalog,
    clock,
    backgroundVersion,
  } = loadHomeData(user.id);
  const translations = getTranslations(language);
  const highlights = today
    ? selectTodayHighlights(today, classroom, new Date())
    : null;
  const customId = catalog.selected.startsWith("custom:")
    ? Number(catalog.selected.slice(7))
    : null;
  const hasImage = catalog.selected === "legacy" || customId !== null;

  return (
    <div
      className="home-shell"
      data-has-background={hasImage}
      data-background-preset={catalog.selected}
      style={
        hasImage
          ? ({
              "--home-background-image":
                customId !== null
                  ? `url(/api/home-background?wallpaperId=${customId})`
                  : `url(/api/home-background?v=${backgroundVersion})`,
            } as CSSProperties)
          : undefined
      }
    >
      {clock.enabled ? (
        <HomeClock locale={language} position={clock.position} />
      ) : null}
      <section className="home-hero" aria-labelledby="home-title">
        <h1 id="home-title" className="sr-only">
          OpenStudyHub
        </h1>
        <AsciiLogo
          value={asciiLogo}
          compactValue={compactAsciiLogo}
          label={brandText}
          responsive
        />
        <HomeInteractions
          shortcuts={allShortcuts}
          available={databaseAvailable}
          unavailableMessage={`${translations.states.unavailable} ${translations.settings.checkMigrations}`}
          catalog={catalog}
          wallpaperLimitMiB={
            process.env.OPENSTUDYHUB_V2_ENABLED === "1" ? 10 : 5
          }
          appearance={appearance}
          theme={theme}
          clockEnabled={clock.enabled}
          clockPosition={clock.position}
          todayWidgetEnabled={todayWidgetEnabled}
        />
        {today ? (
          <aside
            className="home-today"
            aria-label={translations.academic.todayTitle}
          >
            <Link href="/today">
              <span className="page-kicker">
                {translations.academic.todayTitle}
              </span>
              {highlights?.lesson ? (
                <span>
                  <strong>
                    {highlights.lessonIsToday
                      ? uiText(language, "Próxima aula", "Next class")
                      : uiText(language, "Próximo encontro", "Next meeting")}
                    : {highlights.lesson.subjectName}
                  </strong>
                  <small>
                    {"date" in highlights.lesson
                      ? `${new Intl.DateTimeFormat(language, { weekday: "short", day: "numeric", month: "short" }).format(new Date(`${highlights.lesson.date}T12:00:00`))} · `
                      : ""}
                    {formatMinutes(highlights.lesson.startsAtMinutes)}
                  </small>
                </span>
              ) : highlights?.event ? (
                <span>
                  <strong>
                    <UiCopy pt="Próximo evento:" en="Next event:" />{" "}
                    {highlights.event.title}
                  </strong>
                </span>
              ) : null}
              {highlights?.deadline ? (
                <span>
                  <strong>
                    <UiCopy pt="Prazo:" en="Due:" /> {highlights.deadline.title}
                  </strong>
                  <small>
                    {new Intl.DateTimeFormat(language, {
                      dateStyle: "short",
                      timeStyle: "short",
                    }).format(highlights.deadline.dueAt!)}
                  </small>
                </span>
              ) : null}
              {highlights?.update ? (
                <span className="home-today-update">
                  <UiCopy pt="Mural atualizado:" en="Stream updated:" />{" "}
                  {highlights.update.title}
                </span>
              ) : null}
              {!highlights?.lesson &&
              !highlights?.event &&
              !highlights?.deadline &&
              !highlights?.update ? (
                <span>
                  <UiCopy
                    pt="Veja sua agenda acadêmica."
                    en="See your academic schedule."
                  />
                </span>
              ) : null}
              <span className="home-today-open">
                <UiCopy pt="Abrir Hoje →" en="Open Today →" />
              </span>
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
