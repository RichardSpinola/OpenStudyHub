"use client";
import { UiCopy } from "@/components/ui-language-provider";

import Link from "next/link";
import { useEffect, useState } from "react";

type Status = { attention: boolean; connection: string };
export function GoogleConnectionNotice() {
  const [status, setStatus] = useState<Status | null>(null);
  useEffect(() => {
    let cancelled = false;
    const poll = async () => {
      try {
        const response = await fetch("/api/v2/google/health", {
          cache: "no-store",
        });
        if (response.ok && !cancelled)
          setStatus((await response.json()) as Status);
      } catch {
        /* A falha de rede não significa revogação do Google. */
      }
    };
    void poll();
    const interval = window.setInterval(() => void poll(), 60_000);
    const visible = () => {
      if (!document.hidden) void poll();
    };
    document.addEventListener("visibilitychange", visible);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", visible);
    };
  }, []);
  if (!status?.attention) return null;
  return (
    <aside className="google-connection-notice" role="alert">
      <span>
        <UiCopy
          pt="Sua conta Google precisa ser reconectada."
          en="Your Google account needs to be reconnected."
        />
      </span>
      <Link href="/google">
        <UiCopy pt="Abrir integração" en="Open integration" />
      </Link>
      <button
        type="button"
        onClick={async () => {
          const response = await fetch("/api/v2/google/health", {
            method: "POST",
          });
          if (response.ok) setStatus((await response.json()) as Status);
        }}
      >
        <UiCopy pt="Não mostrar novamente" en="Do not show again" />
      </button>
    </aside>
  );
}
