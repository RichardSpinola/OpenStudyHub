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
          ? tr("Sincronizando no Drive…", "Syncing to Drive…")
          : retry
            ? tr(
                "Tentar sincronizar esta prévia novamente",
                "Retry syncing this preview",
              )
            : tr(
                "Confirmar e sincronizar no Drive",
                "Confirm and sync to Drive",
              )}
      </button>
      {pending ? (
        <div className="project-sync-progress" role="status" aria-live="polite">
          <span>
            <UiCopy
              pt="Criando ou verificando as pastas no Drive e enviando os arquivos…"
              en="Creating or checking Drive folders and uploading files…"
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
