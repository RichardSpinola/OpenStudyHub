"use client";

import { useState } from "react";
import { useUiText } from "@/components/ui-language-provider";

export function SyncAllClassrooms({ offeringIds }: { offeringIds: number[] }) {
  const tr = useUiText();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function syncAll() {
    setBusy(true);
    setMessage("");
    let completed = 0;
    try {
      for (const offeringId of offeringIds) {
        const response = await fetch("/api/v2/classroom/sync", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ offeringId }),
        });
        if (!response.ok) throw new Error();
        const result = (await response.json()) as { outcome?: string };
        if (result.outcome !== "updated" && result.outcome !== "fresh")
          throw new Error();
        completed += 1;
        setMessage(tr(`${completed} de ${offeringIds.length} disciplinas sincronizadas.`, `${completed} of ${offeringIds.length} subjects synced.`));
      }
    } catch {
      setMessage(tr(`Sincronização interrompida após ${completed} de ${offeringIds.length} disciplinas. Tente novamente.`, `Sync stopped after ${completed} of ${offeringIds.length} subjects. Try again.`));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <button type="button" onClick={() => void syncAll()} disabled={busy || !offeringIds.length}>
        {busy ? tr("Sincronizando…", "Syncing…") : tr("Sincronizar tudo", "Sync all")}
      </button>
      {message ? <p role="status">{message}</p> : null}
    </div>
  );
}
