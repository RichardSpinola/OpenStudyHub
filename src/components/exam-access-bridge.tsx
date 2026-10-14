"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { examRestrictedPath } from "@/lib/exam-paths";
export function ExamAccessBridge({
  restricted,
  endsAt,
}: {
  restricted: boolean;
  endsAt: number | null;
}) {
  const router = useRouter();
  useEffect(() => {
    let busy = false;
    const controller = new AbortController();
    async function check() {
      if (busy || document.hidden) return;
      busy = true;
      try {
        const r = await fetch("/api/academic-access", {
          cache: "no-store",
          signal: controller.signal,
        });
        if (!r.ok) return;
        const status = await r.json();
        if (
          status.restricted &&
          (examRestrictedPath(window.location.pathname) ||
            (/^\/subjects\/\d+$/.test(window.location.pathname) &&
              ["notes", "documents", "projects"].includes(
                new URLSearchParams(window.location.search).get("view") ?? "",
              )))
        ) {
          window.location.replace("/today?restriction=exam");
          return;
        }
        if (status.restricted !== restricted || status.endsAt !== endsAt)
          router.refresh();
      } catch {
        /* Server authorization remains authoritative while offline. */
      } finally {
        busy = false;
      }
    }
    const interval = window.setInterval(check, 30000);
    const focus = () => {
      void check();
    };
    document.addEventListener("visibilitychange", focus);
    window.addEventListener("focus", focus);
    const deadline = endsAt
      ? window.setTimeout(
          check,
          Math.max(0, Math.min(2147483647, endsAt - Date.now() + 200)),
        )
      : undefined;
    return () => {
      controller.abort();
      window.clearInterval(interval);
      if (deadline) window.clearTimeout(deadline);
      document.removeEventListener("visibilitychange", focus);
      window.removeEventListener("focus", focus);
    };
  }, [restricted, endsAt, router]);
  return null;
}
