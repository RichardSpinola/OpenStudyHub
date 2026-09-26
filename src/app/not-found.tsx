"use client";
import { UiCopy } from "@/components/ui-language-provider";

import { useUiTranslations } from "@/components/ui-language-provider";

export default function NotFoundPage() {
  const { states } = useUiTranslations();

  return (
    <section className="page-state">
      <p className="eyebrow">
        <UiCopy pt="404 // NÃO ENCONTRADO" en="404 // NOT FOUND" />
      </p>
      <h1>{states.notFound}</h1>
    </section>
  );
}
