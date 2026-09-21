"use client";

import { useUiTranslations } from "@/components/ui-language-provider";

export default function NotFoundPage() {
  const { states } = useUiTranslations();

  return (
    <section className="page-state">
      <p className="eyebrow">404 // NÃO ENCONTRADO</p>
      <h1>{states.notFound}</h1>
    </section>
  );
}
