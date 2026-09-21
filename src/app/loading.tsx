"use client";

import { useUiTranslations } from "@/components/ui-language-provider";

export default function LoadingPage() {
  const { states } = useUiTranslations();

  return (
    <div className="loading-state" role="status" aria-live="polite">
      <span className="loading-mark" aria-hidden="true">
        ▒
      </span>
      {states.loading}
    </div>
  );
}
