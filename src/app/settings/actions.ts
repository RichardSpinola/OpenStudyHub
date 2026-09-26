"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { updateBrandConfig, type BrandFigletFont } from "@/lib/home-settings";
import { updateInstitutionName } from "@/lib/institution";
import {
  requireAdminUser,
  requireAuthenticatedUser,
} from "@/lib/authorization";
import { recordAuditEvent } from "@/lib/audit";
import { updateOwnHomePreferences, updateOwnProfile } from "@/lib/profile";
import { createProfileTag, setOwnProfileTag } from "@/lib/collaboration";
import {
  addDemoShortcuts,
  createShortcut,
  deleteShortcut,
  moveShortcut,
  setShortcutEnabled,
  updateShortcut,
} from "@/lib/shortcuts";
import { updateUiLanguage } from "@/lib/ui-language";
import { getStorageLayout, updateStorageLayout } from "@/lib/storage-layout";
import { addExternalLink, deleteExternalLink } from "@/lib/external-links";
import {
  createUserShortcut,
  deleteUserShortcut,
  moveUserShortcut,
  reorderEnabledUserShortcuts,
  setUserShortcutEnabled,
  updateUserShortcut,
} from "@/lib/user-shortcuts";
import { discoverShortcutIcon } from "@/lib/shortcut-icons";
import { updateNotificationPreferences } from "@/lib/notifications";
import { setProjectsFeatureEnabled } from "@/lib/feature-flags";
import { setDriveStorageOwner } from "@/lib/google/storage-owner";
import {
  appearanceSchema,
  getAppearance,
  updateAppearance,
} from "@/lib/appearance";
import { redirect } from "next/navigation";
import { clearSessionCookie } from "@/lib/session-cookie";
import {
  clearUserSessionV2,
  currentUserV2,
  withV2DbAsync,
} from "@/lib/v2/runtime";
import { recordAdminAction } from "@/lib/v2/audit";

const shortcutIdSchema = z.coerce.number().int().positive();
const directionSchema = z.enum(["up", "down"]);
const themeSchema = z.enum(["dark", "light"]);
const clockPositionSchema = z.enum([
  "top-left",
  "top-right",
  "bottom-left",
  "bottom-right",
]);

export type QuickAddState =
  { status: "idle" } | { status: "success" } | { status: "error" };

function optionalText(formData: FormData, key: string): string | null {
  const value = formData.get(key);
  return typeof value === "string" && value.trim() ? value : null;
}

function requiredText(formData: FormData, key: string): string {
  const value = formData.get(key);

  if (typeof value !== "string") {
    throw new Error("Dados de formulário inválidos.");
  }

  return value;
}

function refreshConfiguration() {
  revalidatePath("/");
  revalidatePath("/settings");
}

export async function updateProfileAction(formData: FormData) {
  const actor = await requireAuthenticatedUser();
  const bio = formData.get("bio");
  updateOwnProfile(actor.id, {
    displayName: requiredText(formData, "displayName"),
    locale: requiredText(formData, "locale") as "pt-BR" | "en",
    ...(typeof bio === "string" ? { bio } : {}),
  });
  recordAuditEvent({
    actorUserId: actor.id,
    action: "profile.update",
    targetType: "user",
    targetId: String(actor.id),
    summary: "profile preferences updated",
  });
  revalidatePath("/", "layout");
  revalidatePath("/settings");
}

export async function setOwnProfileTagAction(formData: FormData) {
  const actor = await requireAuthenticatedUser();
  setOwnProfileTag(
    actor.id,
    shortcutIdSchema.parse(formData.get("tagId")),
    formData.get("assigned") === "true",
  );
  revalidatePath("/settings");
  revalidatePath(`/profile/${actor.id}`);
}

export async function updateNotificationPreferencesAction(formData: FormData) {
  const actor = await requireAuthenticatedUser();
  updateNotificationPreferences(actor.id, {
    desktopEnabled: formData.get("desktopEnabled") === "true",
    dm: z.enum(["all", "mentions", "none"]).parse(formData.get("dm")),
    groupDefault: z
      .enum(["all", "mentions", "none"])
      .parse(formData.get("groupDefault")),
    audienceDefault: z
      .enum(["all", "mentions", "none"])
      .parse(formData.get("audienceDefault")),
    mentionsEnabled: formData.get("mentionsEnabled") === "true",
    repliesEnabled: formData.get("repliesEnabled") === "true",
  });
  revalidatePath("/settings");
}

export async function createProfileTagAction(formData: FormData) {
  const actor = await requireAuthenticatedUser();
  const optionalId = (key: string) => {
    const value = formData.get(key);
    return typeof value === "string" && value
      ? shortcutIdSchema.parse(value)
      : null;
  };
  createProfileTag(actor.id, {
    label: requiredText(formData, "label"),
    scopeType: z
      .enum(["instance", "program", "cohort"])
      .parse(formData.get("scopeType")),
    programId: optionalId("programId"),
    cohortId: optionalId("cohortId"),
    selfAssignable: formData.get("selfAssignable") === "true",
  });
  revalidatePath("/settings");
}

export async function updateHomePreferencesAction(formData: FormData) {
  const actor = await requireAuthenticatedUser();
  updateOwnHomePreferences(actor.id, {
    theme: themeSchema.parse(formData.get("theme")),
    todayWidgetEnabled: formData.get("todayWidgetEnabled") === "true",
    homeClockEnabled: formData.get("homeClockEnabled") === "true",
    homeClockPosition: clockPositionSchema.parse(
      formData.get("homeClockPosition"),
    ),
  });
  recordAuditEvent({
    actorUserId: actor.id,
    action: "profile.home_preferences_update",
    targetType: "user",
    targetId: String(actor.id),
    summary: "personal Home appearance updated",
  });
  revalidatePath("/", "layout");
  revalidatePath("/settings");
}

export async function updateAppearanceAction(formData: FormData) {
  const actor = await requireAuthenticatedUser();
  updateAppearance(
    actor.id,
    appearanceSchema.parse({
      ...getAppearance(actor.id),
      theme: formData.get("designTheme"),
      mode: formData.get("appearanceMode"),
      density: formData.get("density"),
      accent: formData.get("accent"),
      customAccent: formData.get("customAccent"),
      navigationLayout: formData.get("navigationLayout"),
      searchEngine: formData.get("searchEngine"),
    }),
  );
  revalidatePath("/", "layout");
  revalidatePath("/settings");
}

export async function saveAppearanceSelectionAction(input: unknown) {
  const actor = await requireAuthenticatedUser();
  updateAppearance(actor.id, appearanceSchema.parse(input));
  revalidatePath("/", "layout");
}

export async function updateAccessibilityAction(formData: FormData) {
  const actor = await requireAuthenticatedUser();
  const motion = z.enum(["system", "reduce"]).parse(formData.get("motion"));
  const contrast = z.enum(["system", "high"]).parse(formData.get("contrast"));
  updateAppearance(actor.id, { ...getAppearance(actor.id), motion, contrast });
  revalidatePath("/", "layout");
  revalidatePath("/settings");
}

export async function deactivateOwnV2AccountAction(
  formData: FormData,
): Promise<void> {
  if (process.env.OPENSTUDYHUB_V2_ENABLED !== "1")
    throw new Error("Esta ação exige a identidade V2.");
  await withV2DbAsync(async (db) => {
    const user = await currentUserV2(db);
    if (!user || user.kind !== "user")
      throw new Error("Entre com sua conta normal.");
    const login = (
      db.prepare("SELECT login FROM users WHERE id=?").get(user.id) as {
        login: string;
      }
    ).login;
    if (formData.get("confirmation") !== login)
      throw new Error("Digite seu login exato para confirmar.");
    db.transaction(() => {
      db.prepare("UPDATE users SET active=0 WHERE id=?").run(user.id);
      db.prepare(
        "UPDATE user_sessions SET revoked_at=? WHERE user_id=? AND revoked_at IS NULL",
      ).run(Date.now(), user.id);
      recordAdminAction(db, user, "user.self_deactivate", "user", user.id);
    })();
  });
  await clearUserSessionV2();
  await clearSessionCookie();
  redirect("/login");
}

export async function updateHomeSearchAction(formData: FormData) {
  const actor = await requireAuthenticatedUser();
  const searchEngine = z
    .enum(["google", "scholar", "duckduckgo", "startpage", "ecosia"])
    .parse(formData.get("searchEngine"));
  updateAppearance(actor.id, { ...getAppearance(actor.id), searchEngine });
  revalidatePath("/");
  revalidatePath("/settings");
}

export async function updateIdentityAction(formData: FormData) {
  const actor = await requireAdminUser();
  updateBrandConfig({
    text: requiredText(formData, "brandText"),
    font: requiredText(formData, "brandFont") as BrandFigletFont,
  });
  recordAuditEvent({
    actorUserId: actor.id,
    action: "settings.brand_update",
    targetType: "app_setting",
    targetId: "home.brand",
    summary: "brand configuration updated",
  });
  refreshConfiguration();
}

export async function updateLanguageAction(formData: FormData) {
  const actor = await requireAdminUser();
  updateUiLanguage(requiredText(formData, "language"));
  recordAuditEvent({
    actorUserId: actor.id,
    action: "settings.language_update",
    targetType: "app_setting",
    targetId: "ui.language",
    summary: "interface language updated",
  });
  revalidatePath("/", "layout");
}

export async function updateInstitutionAction(formData: FormData) {
  const actor = await requireAdminUser();
  updateInstitutionName(actor.id, requiredText(formData, "institutionName"));
  revalidatePath("/settings");
}

export async function updateProjectsFeatureAction(formData: FormData) {
  const actor = await requireAdminUser();
  setProjectsFeatureEnabled(
    actor.id,
    formData.get("projectsEnabled") === "true",
  );
  revalidatePath("/", "layout");
  revalidatePath("/subjects", "layout");
  revalidatePath("/settings");
}

export async function addExternalLinkAction(formData: FormData) {
  const actor = await requireAdminUser();
  addExternalLink(actor.id, {
    label: requiredText(formData, "label"),
    url: requiredText(formData, "url"),
    newTab: formData.get("newTab") === "true",
  });
  revalidatePath("/", "layout");
  revalidatePath("/settings");
}

export async function deleteExternalLinkAction(formData: FormData) {
  const actor = await requireAdminUser();
  deleteExternalLink(actor.id, requiredText(formData, "linkId"));
  revalidatePath("/", "layout");
  revalidatePath("/settings");
}

export async function updateStorageLayoutAction(formData: FormData) {
  const actor = await requireAdminUser();
  const current = getStorageLayout();
  updateStorageLayout(actor.id, {
    includeCohort: formData.get("includeCohort") === "true",
    patterns: {
      program: requiredText(formData, "programPattern"),
      cohort: requiredText(formData, "cohortPattern"),
      period: requiredText(formData, "periodPattern"),
      subject: requiredText(formData, "subjectPattern"),
    },
    categories: current.categories.map((category) => ({
      ...category,
      label: requiredText(formData, `categoryLabel:${category.key}`),
      enabled: formData.get(`categoryEnabled:${category.key}`) === "true",
    })),
  });
  recordAuditEvent({
    actorUserId: actor.id,
    action: "settings.storage_update",
    targetType: "storage_settings",
    targetId: "1",
    summary: "storage layout updated without moving existing Drive folders",
  });
  revalidatePath("/settings");
}

export async function updateDriveStorageOwnerAction(formData: FormData) {
  const actor = await requireAdminUser();
  const value = optionalText(formData, "storageOwnerUserId");
  setDriveStorageOwner(
    actor.id,
    value === null ? null : shortcutIdSchema.parse(value),
  );
  revalidatePath("/settings");
}

export async function createShortcutAction(formData: FormData) {
  const actor = await requireAdminUser();
  const shortcut = createShortcut({
    name: requiredText(formData, "name"),
    url: requiredText(formData, "url"),
    icon: optionalText(formData, "icon"),
  });
  await discoverShortcutIcon("instance", shortcut.id, null, shortcut.url);
  recordAuditEvent({
    actorUserId: actor.id,
    action: "shortcut.create",
    targetType: "shortcut",
    targetId: String(shortcut.id),
    summary: "shortcut created",
  });
  refreshConfiguration();
}

export async function createShortcutFromHomeAction(
  _previousState: QuickAddState,
  formData: FormData,
): Promise<QuickAddState> {
  const actor = await requireAuthenticatedUser();
  try {
    const shortcut = createUserShortcut(actor.id, {
      name: requiredText(formData, "name"),
      url: requiredText(formData, "url"),
      icon: optionalText(formData, "icon"),
    });
    await discoverShortcutIcon("user", shortcut.id, actor.id, shortcut.url);
    recordAuditEvent({
      actorUserId: actor.id,
      action: "user_shortcut.create",
      targetType: "user_shortcut",
      targetId: String(shortcut.id),
      summary: "personal shortcut created from home",
    });
    refreshConfiguration();
    return { status: "success" };
  } catch {
    return { status: "error" };
  }
}

export async function updateShortcutAction(formData: FormData) {
  const actor = await requireAdminUser();
  const id = shortcutIdSchema.parse(formData.get("id"));
  const shortcut = updateShortcut(id, {
    name: requiredText(formData, "name"),
    url: requiredText(formData, "url"),
    icon: optionalText(formData, "icon"),
  });
  await discoverShortcutIcon("instance", shortcut.id, null, shortcut.url);
  recordAuditEvent({
    actorUserId: actor.id,
    action: "shortcut.update",
    targetType: "shortcut",
    targetId: String(id),
    summary: "shortcut updated",
  });
  refreshConfiguration();
}

export async function toggleShortcutAction(formData: FormData) {
  const actor = await requireAdminUser();
  const id = shortcutIdSchema.parse(formData.get("id"));
  const enabled = requiredText(formData, "enabled") === "true";
  setShortcutEnabled(id, enabled);
  recordAuditEvent({
    actorUserId: actor.id,
    action: "shortcut.state_change",
    targetType: "shortcut",
    targetId: String(id),
    summary: enabled ? "shortcut enabled" : "shortcut disabled",
  });
  refreshConfiguration();
}

export async function moveShortcutAction(formData: FormData) {
  const actor = await requireAdminUser();
  const id = shortcutIdSchema.parse(formData.get("id"));
  const direction = directionSchema.parse(formData.get("direction"));
  moveShortcut(id, direction);
  recordAuditEvent({
    actorUserId: actor.id,
    action: "shortcut.reorder",
    targetType: "shortcut",
    targetId: String(id),
    summary: "shortcut order changed",
  });
  refreshConfiguration();
}

export async function reorderShortcutsAction(orderedIds: number[]) {
  const actor = await requireAuthenticatedUser();
  const ids = z.array(z.number().int().positive()).parse(orderedIds);
  reorderEnabledUserShortcuts(actor.id, ids);
  recordAuditEvent({
    actorUserId: actor.id,
    action: "user_shortcut.reorder",
    targetType: "user_shortcut_collection",
    targetId: null,
    summary: "shortcut order changed",
  });
  refreshConfiguration();
}

export async function createPersonalShortcutAction(formData: FormData) {
  const actor = await requireAuthenticatedUser();
  const shortcut = createUserShortcut(actor.id, {
    name: requiredText(formData, "name"),
    url: requiredText(formData, "url"),
    icon: optionalText(formData, "icon"),
  });
  await discoverShortcutIcon("user", shortcut.id, actor.id, shortcut.url);
  recordAuditEvent({
    actorUserId: actor.id,
    action: "user_shortcut.create",
    targetType: "user_shortcut",
    targetId: String(shortcut.id),
    summary: "personal shortcut created",
  });
  refreshConfiguration();
}

export async function updatePersonalShortcutAction(formData: FormData) {
  const actor = await requireAuthenticatedUser();
  const id = shortcutIdSchema.parse(formData.get("id"));
  const shortcutUrl = requiredText(formData, "url");
  updateUserShortcut(actor.id, id, {
    name: requiredText(formData, "name"),
    url: shortcutUrl,
    icon: optionalText(formData, "icon"),
  });
  await discoverShortcutIcon("user", id, actor.id, shortcutUrl);
  recordAuditEvent({
    actorUserId: actor.id,
    action: "user_shortcut.update",
    targetType: "user_shortcut",
    targetId: String(id),
    summary: "personal shortcut updated",
  });
  refreshConfiguration();
}

export async function togglePersonalShortcutAction(formData: FormData) {
  const actor = await requireAuthenticatedUser();
  const id = shortcutIdSchema.parse(formData.get("id"));
  const enabled = requiredText(formData, "enabled") === "true";
  setUserShortcutEnabled(actor.id, id, enabled);
  recordAuditEvent({
    actorUserId: actor.id,
    action: "user_shortcut.state_change",
    targetType: "user_shortcut",
    targetId: String(id),
    summary: enabled
      ? "personal shortcut enabled"
      : "personal shortcut disabled",
  });
  refreshConfiguration();
}

export async function movePersonalShortcutAction(formData: FormData) {
  const actor = await requireAuthenticatedUser();
  const id = shortcutIdSchema.parse(formData.get("id"));
  const direction = directionSchema.parse(formData.get("direction"));
  moveUserShortcut(actor.id, id, direction);
  recordAuditEvent({
    actorUserId: actor.id,
    action: "user_shortcut.reorder",
    targetType: "user_shortcut",
    targetId: String(id),
    summary: "personal shortcut order changed",
  });
  refreshConfiguration();
}

export async function deletePersonalShortcutAction(formData: FormData) {
  const actor = await requireAuthenticatedUser();
  const id = shortcutIdSchema.parse(formData.get("id"));
  deleteUserShortcut(actor.id, id);
  recordAuditEvent({
    actorUserId: actor.id,
    action: "user_shortcut.delete",
    targetType: "user_shortcut",
    targetId: String(id),
    summary: "personal shortcut deleted",
  });
  refreshConfiguration();
}

export async function deleteShortcutAction(formData: FormData) {
  const actor = await requireAdminUser();
  const id = shortcutIdSchema.parse(formData.get("id"));
  deleteShortcut(id);
  recordAuditEvent({
    actorUserId: actor.id,
    action: "shortcut.delete",
    targetType: "shortcut",
    targetId: String(id),
    summary: "shortcut deleted",
  });
  refreshConfiguration();
}

export async function addDemoShortcutsAction() {
  const actor = await requireAdminUser();
  const shortcuts = addDemoShortcuts();
  await Promise.all(
    shortcuts.map((shortcut) =>
      discoverShortcutIcon("instance", shortcut.id, null, shortcut.url),
    ),
  );
  recordAuditEvent({
    actorUserId: actor.id,
    action: "shortcut.demo_create",
    targetType: "shortcut_collection",
    targetId: null,
    summary: "generic demo shortcuts created",
  });
  refreshConfiguration();
}
