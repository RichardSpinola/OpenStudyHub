"use client";

import { useActionState } from "react";

import {
  syncAllClassroomsAction,
  type SyncAllClassroomsState,
} from "@/app/settings/google-actions";

const initialState: SyncAllClassroomsState = { results: [] };

export function ClassroomSyncAll() {
  const [state, action, pending] = useActionState(
    syncAllClassroomsAction,
    initialState,
  );
  return (
    <div className="classroom-sync-all">
      <form action={action}>
        <button type="submit" disabled={pending}>
          {pending ? "SINCRONIZANDO…" : "SINCRONIZAR TUDO"}
        </button>
      </form>
      {state.results.length ? (
        <ul aria-live="polite">
          {state.results.map((result) => (
            <li key={result.offeringId}>
              <strong>{result.subjectName}</strong>
              <span>
                {result.status === "fresh"
                  ? "cache atual"
                  : result.status === "synced"
                    ? `${result.activities ?? 0} atividade(s) sincronizada(s)`
                    : "falha; as demais matérias continuaram"}
              </span>
            </li>
          ))}
        </ul>
      ) : state.message ? (
        <p role="status">{state.message}</p>
      ) : null}
    </div>
  );
}
