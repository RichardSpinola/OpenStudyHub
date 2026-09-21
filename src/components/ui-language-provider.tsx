"use client";

import { createContext, type ReactNode, useContext } from "react";

import { getTranslations } from "@/lib/translations";
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
