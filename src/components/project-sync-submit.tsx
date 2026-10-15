"use client";
import { UiCopy, useUiText } from "@/components/ui-language-provider";

import { useFormStatus } from "react-dom";

export function ProjectSyncSubmit({ retry = false }: { retry?: boolean }) {
  const tr = useUiText();
  const { pending } = useFormStatus();
  return (
    <div className="project-sync-submit">
      <button type="submit" disabled={pending} aria-busy={pending}>
        {pending
          ? tr("Salvando versão…", "Saving version…")
          : retry
            ? tr(
                "Tentar salvar esta prévia novamente",
                "Retry saving this preview",
              )
            : tr("Confirmar e salvar versão", "Confirm and save version")}
      </button>
      {pending ? (
        <div className="project-sync-progress" role="status" aria-live="polite">
          <span>
            <UiCopy
              pt="Verificando o pacote e salvando os arquivos no armazenamento escolhido…"
              en="Checking the package and saving files in the chosen storage…"
            />
          </span>
          <div className="project-sync-progress-track" aria-hidden="true">
            {Array.from({ length: 16 }, (_, index) => (
              <span key={index} style={{ animationDelay: `${index * 85}ms` }} />
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
