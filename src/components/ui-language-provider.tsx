"use client";

import { createContext, type ReactNode, useCallback, useContext } from "react";

import { getTranslations, uiText } from "@/lib/translations";
import type { UiLanguage } from "@/lib/ui-language";

const UiLanguageContext = createContext<UiLanguage>("pt-BR");

export function UiLanguageProvider({
  children,
  language,
}: {
  children: ReactNode;
  language: UiLanguage;
}) {
  return (
    <UiLanguageContext.Provider value={language}>
      {children}
    </UiLanguageContext.Provider>
  );
}

export function useUiTranslations() {
  return getTranslations(useContext(UiLanguageContext));
}

export function useUiLanguage() {
  return useContext(UiLanguageContext);
}

export function useUiText() {
  const language = useContext(UiLanguageContext);
  return useCallback(
    (portuguese: string, english: string) =>
      uiText(language, portuguese, english),
    [language],
  );
}

export function UiCopy({ pt, en }: { pt: string; en: string }) {
  return <>{useUiText()(pt, en)}</>;
}
