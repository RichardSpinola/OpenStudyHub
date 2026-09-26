"use client";

import { useEffect, type ReactNode } from "react";

function key() {
  const q = new URLSearchParams(window.location.search);
  return `osh-admin-scroll:${window.location.pathname}:${q.get("section") ?? q.get("area") ?? ""}`;
}

function currentScroll() {
  return Math.max(
    window.scrollY,
    document.documentElement.scrollTop,
    document.body.scrollTop,
  );
}

export function ContextPreserver({ children }: { children: ReactNode }) {
  useEffect(() => {
    const saved = sessionStorage.getItem(key());
    if (!saved) return;
    sessionStorage.removeItem(key());
    const [position, time] = saved.split(":").map(Number);
    if (!Number.isFinite(position) || Date.now() - time > 30_000) return;
    const restore = () => {
      if (Math.abs(currentScroll() - position) < 2) return;
      document.body.scrollTo({ top: position, behavior: "instant" });
      window.scrollTo({ top: position, behavior: "instant" });
    };
    const frame = requestAnimationFrame(() => requestAnimationFrame(restore));
    const retry = window.setTimeout(restore, 180);
    return () => {
      cancelAnimationFrame(frame);
      window.clearTimeout(retry);
    };
  });
  return (
    <div
      onSubmitCapture={() =>
        sessionStorage.setItem(key(), `${currentScroll()}:${Date.now()}`)
      }
    >
      {children}
    </div>
  );
}
