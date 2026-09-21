"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type Item = {
  id: number;
  title: string;
  bodyPreview: string | null;
  readAt: number | null;
  createdAt: number;
};

function mergeUnique(current: Item[], incoming: Item[]): Item[] {
  const map = new Map<number, Item>();
  for (const item of [...incoming, ...current]) map.set(item.id, item);
  return [...map.values()].sort((a, b) => b.id - a.id).slice(0, 30);
}

export function NotificationCenter() {
  const [items, setItems] = useState<Item[]>([]);
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const [permission, setPermission] = useState<
    NotificationPermission | "unsupported"
  >("unsupported");
  const lastId = useRef(0);
  const inFlight = useRef(false);
  const bootstrapped = useRef(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const poll = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    try {
      const response = await fetch(
        `/api/notifications?after=${lastId.current}`,
        { cache: "no-store" },
      );
      if (!response.ok) return;
      const payload = (await response.json()) as {
        notifications: Item[];
        unread: number;
        preferences: { desktopEnabled: boolean };
      };
      setUnread(payload.unread);
      if (!payload.notifications.length) {
        bootstrapped.current = true;
        return;
      }
      const previousLastId = lastId.current;
      lastId.current = Math.max(
        previousLastId,
        ...payload.notifications.map(({ id }) => id),
      );
      setItems((current) => mergeUnique(current, payload.notifications));

      const shouldNotifyDesktop =
        bootstrapped.current &&
        payload.preferences.desktopEnabled &&
        typeof Notification !== "undefined" &&
        Notification.permission === "granted";
      if (shouldNotifyDesktop) {
        for (const item of payload.notifications) {
          if (item.id <= previousLastId) continue;
          new Notification(item.title, {
            body: item.bodyPreview ?? undefined,
            icon: "/brand/notification-icon.png",
          });
        }
      }
      bootstrapped.current = true;
    } finally {
      inFlight.current = false;
    }
  }, []);

  useEffect(() => {
    const permissionTimer = window.setTimeout(() => {
      if (typeof Notification !== "undefined") {
        setPermission(Notification.permission);
      }
    }, 0);
    void poll();
    const interval = window.setInterval(poll, 5000);
    const visibility = () => {
      if (!document.hidden) void poll();
    };
    document.addEventListener("visibilitychange", visibility);
    return () => {
      window.clearTimeout(permissionTimer);
      document.removeEventListener("visibilitychange", visibility);
      window.clearInterval(interval);
    };
  }, [poll]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  async function requestPermission() {
    if (typeof Notification === "undefined") return;
    const next = await Notification.requestPermission();
    setPermission(next);
  }

  function testNotification() {
    if (typeof Notification === "undefined") return;
    if (Notification.permission !== "granted") return;
    new Notification("OpenStudyHub", {
      body: "As notificações estão funcionando.",
      icon: "/brand/notification-icon.png",
    });
  }

  async function markRead(item: Item) {
    if (item.readAt) return;
    const response = await fetch("/api/notifications", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ notificationId: item.id }),
    });
    if (response.ok) {
      setItems((current) =>
        current.map((candidate) =>
          candidate.id === item.id
            ? { ...candidate, readAt: Date.now() }
            : candidate,
        ),
      );
      setUnread((value) => Math.max(0, value - 1));
    }
  }

  return (
    <div className="notification-center" ref={rootRef}>
      <button
        type="button"
        aria-expanded={open}
        aria-label={`Notificações: ${unread} não lidas`}
        onClick={() => setOpen((value) => !value)}
      >
        NOTIF{unread ? ` ${unread}` : ""}
      </button>
      {open ? (
        <div
          className="notification-popover"
          role="dialog"
          aria-label="Notificações"
        >
          <strong>NOTIFICAÇÕES</strong>
          {permission === "unsupported" ? (
            <span>
              Notificações do sistema não são suportadas neste navegador.
            </span>
          ) : permission === "default" ? (
            <button type="button" onClick={() => void requestPermission()}>
              Permitir no sistema
            </button>
          ) : permission === "granted" ? (
            <button type="button" onClick={testNotification}>
              Testar notificação
            </button>
          ) : (
            <span>Notificações do sistema estão bloqueadas no navegador.</span>
          )}
          {items.length ? (
            <ol>
              {items.map((item) => (
                <li
                  key={`notification-${item.id}`}
                  data-read={Boolean(item.readAt)}
                >
                  <button type="button" onClick={() => void markRead(item)}>
                    <b>{item.title}</b>
                    {item.bodyPreview ? <span>{item.bodyPreview}</span> : null}
                  </button>
                </li>
              ))}
            </ol>
          ) : (
            <span>Nenhuma notificação.</span>
          )}
        </div>
      ) : null}
    </div>
  );
}
