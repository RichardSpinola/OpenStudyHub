"use client";
import {
  UiCopy,
  useUiLanguage,
  useUiText,
} from "@/components/ui-language-provider";
import { useCallback, useEffect, useState } from "react";

type Status = {
  state: { status: string; success: number | null; error: string | null };
  items: Array<{ id: string; title: string; link?: string }>;
};
export function ClassroomSyncStatus({
  offeringId,
  label,
}: {
  offeringId: number;
  label: string;
}) {
  const tr = useUiText();
  const language = useUiLanguage();
  const [data, setData] = useState<Status | null>(null);
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    try {
      const response = await fetch(
        `/api/v2/classroom/status?offeringId=${offeringId}`,
        { cache: "no-store" },
      );
      if (response.ok) setData((await response.json()) as Status);
    } catch {
      /* Cached state remains visible. */
    }
  }, [offeringId]);
  useEffect(() => {
    const initial = setTimeout(() => void load(), 0);
    const timer = setInterval(() => void load(), 15_000);
    return () => {
      clearTimeout(initial);
      clearInterval(timer);
    };
  }, [load]);
  async function sync() {
    setBusy(true);
    try {
      await fetch("/api/v2/classroom/sync", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ offeringId }),
      });
      await load();
    } finally {
      setBusy(false);
    }
  }
  const state = data?.state;
  const status =
    busy || state?.status === "updating"
      ? tr("Atualizando…", "Updating…")
      : state?.status === "needs_reconnect"
        ? tr("Reconectar Google", "Reconnect Google")
        : state?.status === "error"
          ? tr("Erro de sincronização", "Sync error")
          : state?.success
            ? tr(
                `Última sincronização: ${new Date(state.success).toLocaleString(language)}`,
                `Last sync: ${new Date(state.success).toLocaleString(language)}`,
              )
            : tr("Ainda não sincronizado", "Not synced yet");
  return (
    <section className="v2-sync-status" aria-live="polite">
      <h3>{label}</h3>
      <p>{status}</p>
      {state?.error && (
        <p>
          <UiCopy pt="Motivo:" en="Reason:" />{" "}
          {state.error === "rate_limit"
            ? tr(
                "Limite do Google; tente mais tarde",
                "Google rate limit; try later",
              )
            : tr(
                "Google indisponível ou autorização pendente",
                "Google unavailable or authorization pending",
              )}
        </p>
      )}
      <button type="button" onClick={() => void sync()} disabled={busy}>
        <UiCopy pt="Sincronizar agora" en="Sync now" />
      </button>
      {data?.items.length ? (
        <ul>
          {data.items.map((item) => (
            <li key={item.id}>
              {item.link ? (
                <a href={item.link} rel="noopener noreferrer" target="_blank">
                  {item.title}
                </a>
              ) : (
                item.title
              )}
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
