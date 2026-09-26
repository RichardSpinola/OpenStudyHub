export type SettingsSection =
  | "profile"
  | "personalization"
  | "google"
  | "notifications"
  | "privacy"
  | "accessibility"
  | "help"
  | "about"
  | "instance"
  | "administration"
  | "storage";

export function resolveSettingsSection(
  requested: string | undefined,
  access: { instance: boolean; administration: boolean; storage: boolean },
): SettingsSection {
  const allowed: SettingsSection[] = [
    "profile",
    "personalization",
    "google",
    "notifications",
    "help",
    "about",
  ];
  if (access.instance) allowed.push("instance");
  if (access.administration) allowed.push("administration");
  if (access.storage) allowed.push("storage");
  return allowed.includes(requested as SettingsSection)
    ? (requested as SettingsSection)
    : "profile";
}

export type AcademicSettingsSection =
  | "programs"
  | "periods"
  | "cohorts"
  | "subjects"
  | "offerings"
  | "integrations"
  | "schedules"
  | "others";

export function resolveAcademicSettingsSection(
  requested: string | undefined,
  access: { global: boolean; program: boolean },
): AcademicSettingsSection {
  const allowed: AcademicSettingsSection[] = ["cohorts"];
  if (access.global) {
    allowed.push("programs", "periods", "subjects", "others");
  }
  if (access.program) {
    allowed.push("offerings", "integrations", "schedules");
  }
  const fallback = access.global ? "programs" : "cohorts";
  return allowed.includes(requested as AcademicSettingsSection)
    ? (requested as AcademicSettingsSection)
    : fallback;
}
