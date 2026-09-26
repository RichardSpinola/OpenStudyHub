"use server";

import { redirect } from "next/navigation";

import { getCurrentSession } from "@/lib/authorization";
import { createGoogleAuthorizationUrl } from "@/lib/google/oauth";
import {
  completeOnboarding,
  getUserProfile,
  updateOwnProfile,
  updateOwnHomePreferences,
} from "@/lib/profile";
import { updateNotificationPreferences } from "@/lib/notifications";
import { initializeUserShortcuts } from "@/lib/user-shortcuts";
import { currentUserV2, withV2DbAsync } from "@/lib/v2/runtime";
import { appearanceSchema, getAppearance, updateAppearance } from "@/lib/appearance";

const text = (formData: FormData, key: string) => {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
};

export async function connectGoogleDuringOnboardingAction() {
  const session = await getCurrentSession();
  if (!session) redirect("/login");
  if (process.env.OPENSTUDYHUB_V2_ENABLED === "1") redirect("/google");
  redirect(createGoogleAuthorizationUrl(session.user.id));
}

export async function completeOnboardingAction(formData: FormData) {
  const session = await getCurrentSession();
  if (!session) redirect("/login");
  const profile = getUserProfile(session.user.id);
  if (formData.get("replay") === "true" && profile.onboardingVersion >= 1)
    redirect("/");
  const input = {
    displayName: text(formData, "displayName"),
    locale: text(formData, "locale") as "pt-BR" | "en",
    bio: text(formData, "bio"),
  };
  if (profile.onboardingVersion >= 1) updateOwnProfile(session.user.id, input);
  else completeOnboarding(session.user.id, input);
  const currentProfile = getUserProfile(session.user.id);
  updateOwnHomePreferences(session.user.id, {
    todayWidgetEnabled: currentProfile.todayWidgetEnabled,
    theme: text(formData, "theme") === "light" ? "light" : "dark",
    homeClockEnabled: currentProfile.homeClockEnabled,
    homeClockPosition: currentProfile.homeClockPosition,
  });
  updateAppearance(
    session.user.id,
    appearanceSchema.parse({
      ...getAppearance(session.user.id),
      theme: text(formData, "designTheme"),
      mode: text(formData, "appearanceMode"),
      accent: text(formData, "accent"),
      customAccent: text(formData, "customAccent"),
    }),
  );
  updateNotificationPreferences(session.user.id, {
    desktopEnabled: formData.get("desktopEnabled") === "true",
    dm: "all",
    groupDefault: "mentions",
    audienceDefault: "mentions",
    mentionsEnabled: true,
    repliesEnabled: true,
  });
  initializeUserShortcuts(
    session.user.id,
    formData.get("includeDefaultShortcuts") === "true",
  );
  if (process.env.OPENSTUDYHUB_V2_ENABLED === "1")
    await withV2DbAsync(async (db) => {
      const user = await currentUserV2(db);
      if (user)
        db.prepare("DELETE FROM user_onboarding_progress WHERE user_id=?").run(
          user.id,
        );
    });
  redirect("/");
}

export async function saveOnboardingProgressAction(formData: FormData) {
  const session = await getCurrentSession();
  if (!session) redirect("/login");
  const step = Number(formData.get("step"));
  if (!Number.isInteger(step) || step < 0 || step > 5)
    throw new Error("Etapa inválida.");
  if (step >= 1 && formData.has("displayName"))
    updateOwnProfile(session.user.id, {
      displayName: text(formData, "displayName"),
      locale: text(formData, "locale") as "pt-BR" | "en",
      bio: text(formData, "bio"),
    });
  if (step >= 5 && formData.has("designTheme")) {
    const current = getAppearance(session.user.id);
    updateAppearance(
      session.user.id,
      appearanceSchema.parse({
        ...current,
        theme: text(formData, "designTheme"),
        mode: text(formData, "appearanceMode"),
        accent: text(formData, "accent"),
        customAccent: text(formData, "customAccent"),
      }),
    );
  }
  if (process.env.OPENSTUDYHUB_V2_ENABLED === "1")
    await withV2DbAsync(async (db) => {
      const user = await currentUserV2(db);
      if (!user) throw new Error("Sessão normal necessária.");
      db.prepare(
        "INSERT INTO user_onboarding_progress(user_id,step,updated_at) VALUES(?,?,?) ON CONFLICT(user_id) DO UPDATE SET step=excluded.step,updated_at=excluded.updated_at",
      ).run(user.id, step, Date.now());
    });
}
