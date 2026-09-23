"use server";

import { redirect } from "next/navigation";

import { getCurrentSession } from "@/lib/authorization";
import { createGoogleAuthorizationUrl } from "@/lib/google/oauth";
import {
  completeOnboarding,
  getUserProfile,
  updateOwnHomePreferences,
} from "@/lib/profile";
import { updateNotificationPreferences } from "@/lib/notifications";
import { initializeUserShortcuts } from "@/lib/user-shortcuts";

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
  completeOnboarding(session.user.id, {
    displayName: text(formData, "displayName"),
    locale: text(formData, "locale") as "pt-BR" | "en",
    bio: text(formData, "bio"),
  });
  const currentProfile = getUserProfile(session.user.id);
  updateOwnHomePreferences(session.user.id, {
    todayWidgetEnabled: currentProfile.todayWidgetEnabled,
    theme: text(formData, "theme") === "light" ? "light" : "dark",
    homeClockEnabled: currentProfile.homeClockEnabled,
    homeClockPosition: currentProfile.homeClockPosition,
  });
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
  redirect("/");
}
