import type { DatabaseConnection } from "@/lib/db/client";
import { getDatabase } from "@/lib/db/client";
import { z } from "zod";

const UI_LANGUAGE_KEY = "ui.language";

export const uiLanguageSchema = z.enum(["pt-BR", "en"]);
export type UiLanguage = z.infer<typeof uiLanguageSchema>;

export const defaultUiLanguage: UiLanguage = "pt-BR";

export const languageOptions: ReadonlyArray<{
  value: UiLanguage;
  label: string;
}> = [
  { value: "pt-BR", label: "Português (Brasil)" },
  { value: "en", label: "English" },
];

export function resolveUiLanguage(value: unknown): UiLanguage {
  const result = uiLanguageSchema.safeParse(value);
  return result.success ? result.data : defaultUiLanguage;
}

export function getUiLanguage(
  connection: DatabaseConnection = getDatabase(),
): UiLanguage {
  const setting = connection.sqlite
    .prepare("select value from app_settings where key = ?")
    .get(UI_LANGUAGE_KEY) as { value: string } | undefined;

  return resolveUiLanguage(setting?.value);
}

export function updateUiLanguage(
  value: unknown,
  connection: DatabaseConnection = getDatabase(),
): UiLanguage {
  const language = uiLanguageSchema.parse(value);

  connection.sqlite
    .prepare(
      `insert into app_settings (key, value, updated_at)
       values (?, ?, ?)
       on conflict(key) do update set value = excluded.value, updated_at = excluded.updated_at`,
    )
    .run(UI_LANGUAGE_KEY, language, Date.now());

  return language;
}
