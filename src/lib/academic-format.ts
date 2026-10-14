import type { UiLanguage } from "./ui-language";

export function formatMinutes(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return `${String(hours).padStart(2, "0")}:${String(remainder).padStart(2, "0")}`;
}

export function formatAcademicDateTime(
  timestamp: number,
  language: UiLanguage,
): string {
  return new Intl.DateTimeFormat(language, {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "America/Bahia",
  }).format(new Date(timestamp));
}

export function joinLocation(parts: Array<string | null>): string | null {
  const values = [
    ...new Set(
      parts
        .filter((part): part is string => Boolean(part))
        .map((part) => part.trim()),
    ),
  ].filter(
    (part, _, all) =>
      !all.some(
        (other) =>
          other !== part &&
          other.toLocaleLowerCase().endsWith(" " + part.toLocaleLowerCase()),
      ),
  );
  return values.length > 0 ? values.join(" / ") : null;
}
