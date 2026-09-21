import { z } from "zod";

import { displayNameSchema } from "@/lib/access";
import type { DatabaseConnection } from "@/lib/db/client";
import { getDatabase } from "@/lib/db/client";
import {
  defaultUiLanguage,
  uiLanguageSchema,
  type UiLanguage,
} from "@/lib/ui-language";

export type UserProfile = {
  id: number;
  displayName: string;
  bio: string;
  avatarStorageName: string | null;
  bannerStorageName: string | null;
  onboardingVersion: number;
  locale: UiLanguage;
  todayWidgetEnabled: boolean;
  theme: "dark" | "light";
  homeClockEnabled: boolean;
  homeClockPosition: "top-left" | "top-right" | "bottom-left" | "bottom-right";
};

const profileInputSchema = z.object({
  displayName: displayNameSchema,
  locale: uiLanguageSchema,
  bio: z.string().trim().max(500).optional(),
});

export const homePreferencesSchema = z.object({
  todayWidgetEnabled: z.boolean(),
  theme: z.enum(["dark", "light"]),
  homeClockEnabled: z.boolean(),
  homeClockPosition: z.enum([
    "top-left",
    "top-right",
    "bottom-left",
    "bottom-right",
  ]),
});

export function getUserProfile(
  userId: number,
  connection: DatabaseConnection = getDatabase(),
): UserProfile {
  const profile = connection.sqlite
    .prepare(
      `select id, display_name as displayName, bio,
              avatar_storage_name as avatarStorageName,
              banner_storage_name as bannerStorageName,
              onboarding_version as onboardingVersion, locale,
              today_widget_enabled as todayWidgetEnabled, theme,
              home_clock_enabled as homeClockEnabled,
              home_clock_position as homeClockPosition
       from users where id = ? and active = 1`,
    )
    .get(userId) as UserProfile | undefined;

  if (!profile) throw new Error("Perfil não encontrado.");

  return {
    displayName: profile.displayName,
    id: profile.id,
    bio: profile.bio || "",
    avatarStorageName: profile.avatarStorageName,
    bannerStorageName: profile.bannerStorageName,
    onboardingVersion: profile.onboardingVersion,
    locale: uiLanguageSchema.catch(defaultUiLanguage).parse(profile.locale),
    todayWidgetEnabled: Boolean(profile.todayWidgetEnabled),
    theme: profile.theme === "light" ? "light" : "dark",
    homeClockEnabled: Boolean(profile.homeClockEnabled),
    homeClockPosition: z
      .enum(["top-left", "top-right", "bottom-left", "bottom-right"])
      .catch("top-right")
      .parse(profile.homeClockPosition),
  };
}

export function updateOwnProfile(
  userId: number,
  input: z.input<typeof profileInputSchema>,
  connection: DatabaseConnection = getDatabase(),
): UserProfile {
  const profile = profileInputSchema.parse(input);
  const result = connection.sqlite
    .prepare(
      `update users
       set display_name = ?, locale = ?, bio = coalesce(?, bio), updated_at = ?
       where id = ? and active = 1`,
    )
    .run(
      profile.displayName,
      profile.locale,
      profile.bio ?? null,
      Date.now(),
      userId,
    );

  if (result.changes !== 1) throw new Error("Perfil não encontrado.");
  return getUserProfile(userId, connection);
}

export function completeOnboarding(
  userId: number,
  input: z.input<typeof profileInputSchema>,
  connection: DatabaseConnection = getDatabase(),
): UserProfile {
  const profile = profileInputSchema.parse(input);
  const result = connection.sqlite
    .prepare(
      `update users set display_name = ?, locale = ?, bio = ?,
         onboarding_version = 1, updated_at = ?
       where id = ? and active = 1 and onboarding_version < 1`,
    )
    .run(
      profile.displayName,
      profile.locale,
      profile.bio ?? "",
      Date.now(),
      userId,
    );
  if (result.changes !== 1) throw new Error("Onboarding is already complete.");
  return getUserProfile(userId, connection);
}

export function updateOwnHomePreferences(
  userId: number,
  input: z.input<typeof homePreferencesSchema>,
  connection: DatabaseConnection = getDatabase(),
): UserProfile {
  const preferences = homePreferencesSchema.parse(input);
  const result = connection.sqlite
    .prepare(
      `update users set today_widget_enabled = ?, theme = ?,
         home_clock_enabled = ?, home_clock_position = ?, updated_at = ?
       where id = ? and active = 1`,
    )
    .run(
      Number(preferences.todayWidgetEnabled),
      preferences.theme,
      Number(preferences.homeClockEnabled),
      preferences.homeClockPosition,
      Date.now(),
      userId,
    );
  if (result.changes !== 1) throw new Error("Perfil não encontrado.");
  return getUserProfile(userId, connection);
}

export function setTodayWidgetEnabled(
  userId: number,
  enabled: boolean,
  connection: DatabaseConnection = getDatabase(),
): void {
  const result = connection.sqlite
    .prepare(
      `update users set today_widget_enabled = ?, updated_at = ?
       where id = ? and active = 1`,
    )
    .run(Number(enabled), Date.now(), userId);
  if (result.changes !== 1) throw new Error("Perfil não encontrado.");
}

export function getProfileAcademicContext(
  userId: number,
  connection: DatabaseConnection = getDatabase(),
): { programName: string | null; cohortName: string | null } {
  return (
    (connection.sqlite
      .prepare(
        `select p.name as programName, c.name as cohortName
         from users u
         left join user_academic_memberships m on m.user_id = u.id
         left join programs p on p.id = m.program_id
         left join cohorts c on c.id = m.cohort_id
         where u.id = ? and u.active = 1`,
      )
      .get(userId) as
      | { programName: string | null; cohortName: string | null }
      | undefined) ?? { programName: null, cohortName: null }
  );
}
