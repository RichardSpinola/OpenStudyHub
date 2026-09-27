"use client";

import { useActionState } from "react";
import { useUiText } from "@/components/ui-language-provider";

import {
  syncAllClassroomsAction,
  type SyncAllClassroomsState,
} from "@/app/settings/google-actions";

const initialState: SyncAllClassroomsState = { results: [] };

export function ClassroomSyncAll() {
  const tr = useUiText();
  const [state, action, pending] = useActionState(
    syncAllClassroomsAction,
    initialState,
  );
  return (
    <div className="classroom-sync-all">
      <form action={action}>
        <button type="submit" disabled={pending}>
          {pending
            ? tr("SINCRONIZANDO…", "SYNCING…")
            : tr("SINCRONIZAR TUDO", "SYNC ALL")}
        </button>
      </form>
      {state.results.length ? (
        <ul aria-live="polite">
          {state.results.map((result) => (
            <li key={result.offeringId}>
              <strong>{result.subjectName}</strong>
              <span>
                {result.status === "fresh"
                  ? tr("cache atual", "cache current")
                  : result.status === "synced"
                    ? tr(
                        `${result.activities ?? 0} atividade(s) sincronizada(s)`,
                        `${result.activities ?? 0} activity/activities synced`,
                      )
                    : tr(
                        "falha; as demais matérias continuaram",
                        "failed; the remaining subjects continued",
                      )}
              </span>
            </li>
          ))}
        </ul>
      ) : state.message ? (
        <p role="status">
          {tr(
            state.message,
            {
              "Use a página Google para sincronizar seus Classrooms.":
                "Use the Google page to sync your Classrooms.",
              "Nenhuma matéria acessível possui Classroom mapeado.":
                "No accessible subject has a mapped Classroom.",
              "Não foi possível iniciar a sincronização do Classroom.":
                "Could not start Classroom sync.",
            }[state.message] ?? state.message,
          )}
        </p>
      ) : null}
    </div>
  );
}
