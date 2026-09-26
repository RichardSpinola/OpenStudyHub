"use client";
import { UiCopy } from "@/components/ui-language-provider";

import { useUiTranslations } from "@/components/ui-language-provider";

export default function ErrorPage({ reset }: { reset: () => void }) {
  const { states } = useUiTranslations();

  return (
    <section className="page-state" role="alert">
      <p className="eyebrow">
        <UiCopy pt="ERRO // CORE" en="ERROR // CORE" />
      </p>
      <h1>{states.pageError}</h1>
      <p>{states.safeError}</p>
      <button type="button" onClick={reset}>
        {states.retry}
      </button>
    </section>
  );
}
