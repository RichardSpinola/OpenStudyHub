"use client";
import { useSyncExternalStore, useId, type ReactNode } from "react";
import { useSearchParams } from "next/navigation";
export function AdminSettingsTabs({
  items,
}: {
  items: Array<{ id: string; label: string; content: ReactNode }>;
}) {
  const query = useSearchParams(),
    id = useId();
  const saved = useSyncExternalStore(
    (notify) => {
      window.addEventListener("popstate", notify);
      window.addEventListener("storage", notify);
      return () => {
        window.removeEventListener("popstate", notify);
        window.removeEventListener("storage", notify);
      };
    },
    () => {
      try {
        return sessionStorage.getItem("osh-admin-area:" + location.pathname);
      } catch {
        return null;
      }
    },
    () => null,
  );
  function choose(value: string) {
    try {
      sessionStorage.setItem("osh-admin-area:" + location.pathname, value);
    } catch {
      /* Optional persistence. */
    }
    const url = new URL(location.href);
    url.searchParams.set("area", value);
    history.pushState(null, "", url);
    window.dispatchEvent(new PopStateEvent("popstate"));
  }
  const locationQuery = useSyncExternalStore(
    (notify) => {
      window.addEventListener("popstate", notify);
      return () => window.removeEventListener("popstate", notify);
    },
    () => new URLSearchParams(location.search).get("area"),
    () => query.get("area"),
  );
  const candidate = locationQuery ?? saved;
  const active = items.some((i) => i.id === candidate)
    ? candidate
    : items[0].id;
  return (
    <div className="admin-settings-layout">
      <nav
        role="tablist"
        aria-label="Áreas de configuração"
        className="admin-settings-nav"
      >
        {items.map((item, index) => (
          <button
            role="tab"
            id={id + "-" + item.id}
            aria-selected={active === item.id}
            aria-controls={id + "-panel-" + item.id}
            tabIndex={active === item.id ? 0 : -1}
            key={item.id}
            onClick={() => choose(item.id)}
            onKeyDown={(e) => {
              let next = index;
              if (e.key === "ArrowRight" || e.key === "ArrowDown")
                next = (index + 1) % items.length;
              else if (e.key === "ArrowLeft" || e.key === "ArrowUp")
                next = (index + items.length - 1) % items.length;
              else if (e.key === "Home") next = 0;
              else if (e.key === "End") next = items.length - 1;
              else return;
              e.preventDefault();
              choose(items[next].id);
              document.getElementById(id + "-" + items[next].id)?.focus();
            }}
          >
            {item.label}
          </button>
        ))}
      </nav>
      {items.map((item) => (
        <section
          role="tabpanel"
          id={id + "-panel-" + item.id}
          aria-labelledby={id + "-" + item.id}
          hidden={active !== item.id}
          key={item.id}
          className="admin-settings-panel"
        >
          {item.content}
        </section>
      ))}
    </div>
  );
}
