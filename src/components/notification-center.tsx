"use client";
import { UiCopy, useUiText } from "@/components/ui-language-provider";

import { useCallback, useEffect, useRef, useState } from "react";
import { IconBell } from "@tabler/icons-react";
import { useRouter } from "next/navigation";
import { PushControls } from "@/components/push-controls";
import { usePopover } from "@/components/use-popover";

type Item = {
  id: number;
  title: string;
  bodyPreview: string | null;
  readAt: number | null;
  createdAt: number;
  actorName: string | null;
  type: string;
  entityType: string;
  entityId: string;
};

function destination(item: Item): string {
  if (item.entityType === "chat_room" && /^\d+$/.test(item.entityId))
    return `/chat?room=${item.entityId}`;
  if (item.entityType === "study_group" && /^\d+$/.test(item.entityId))
    return `/chat?group=${item.entityId}`;
  if (item.entityType === "note" && /^\d+$/.test(item.entityId))
    return `/notes/${item.entityId}`;
  return "/today";
}

function mergeUnique(current: Item[], incoming: Item[]): Item[] {
  const map = new Map<number, Item>();
  for (const item of [...incoming, ...current]) map.set(item.id, item);
  return [...map.values()].sort((a, b) => b.id - a.id).slice(0, 30);
}

export function NotificationCenter() {
  const tr = useUiText();
  const [items, setItems] = useState<Item[]>([]);
  const [unread, setUnread] = useState(0);
  const { open, setOpen, rootRef, triggerRef } = usePopover<HTMLDivElement>();
  const [error, setError] = useState("");
  const router = useRouter();
  const [permission, setPermission] = useState<
    NotificationPermission | "unsupported"
  >("unsupported");
  const lastId = useRef(0);
  const inFlight = useRef(false);
  const bootstrapped = useRef(false);

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
            body: tr(
              "Você tem uma nova notificação.",
              "You have a new notification.",
            ),
            icon: "/brand/notification-icon.png",
          });
        }
      }
      bootstrapped.current = true;
    } finally {
      inFlight.current = false;
    }
  }, [tr]);

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
    const realtime = (event: Event) => {
      if (
        (event as CustomEvent<{ type: string }>).detail.type === "notification"
      )
        void poll();
    };
    window.addEventListener("openstudyhub:realtime", realtime);
    return () => {
      window.clearTimeout(permissionTimer);
      document.removeEventListener("visibilitychange", visibility);
      window.clearInterval(interval);
      window.removeEventListener("openstudyhub:realtime", realtime);
    };
  }, [poll]);

  async function markRead(item: Item): Promise<boolean> {
    if (item.readAt) return true;
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
      return true;
    }
    setError(
      tr("Não foi possível marcar como lida.", "Could not mark as read."),
    );
    return false;
  }

  async function markAll() {
    const response = await fetch("/api/notifications", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ all: true }),
    });
    if (!response.ok) {
      setError(
        tr(
          "Não foi possível marcar todas como lidas.",
          "Could not mark all as read.",
        ),
      );
      return;
    }
    setItems((current) =>
      current.map((item) => ({ ...item, readAt: item.readAt ?? Date.now() })),
    );
    setUnread(0);
  }

  return (
    <div className="notification-center" ref={rootRef}>
      <button
        ref={triggerRef}
        type="button"
        aria-expanded={open}
        aria-label={tr(
          `Notificações: ${unread} não lidas`,
          `Notifications: ${unread} unread`,
        )}
        onClick={() => setOpen((value) => !value)}
      >
        <IconBell size={20} stroke={1.8} aria-hidden="true" />
        {unread ? <span className="notification-count">{unread}</span> : null}
      </button>
      {open ? (
        <div
          className="notification-popover"
          role="dialog"
          aria-label={tr("Notificações", "Notifications")}
        >
          <header className="notification-header">
            <strong>
              <UiCopy pt="Notificações" en="Notifications" />
            </strong>
            {unread ? (
              <button type="button" onClick={() => void markAll()}>
                <UiCopy pt="Marcar todas como lidas" en="Mark all as read" />
              </button>
            ) : null}
          </header>
          <p className="notification-permission">
            {permission === "denied"
              ? tr(
                  "Avisos do navegador bloqueados; os avisos aqui continuam funcionando.",
                  "Browser notifications are blocked; notifications here still work.",
                )
              : permission === "unsupported"
                ? tr(
                    "Avisos neste painel continuam disponíveis.",
                    "Notifications remain available in this panel.",
                  )
                : ""}
          </p>
          <PushControls onEnabled={() => setPermission("granted")} />
          {error ? <p role="alert">{error}</p> : null}
          {items.length ? (
            <ol>
              {items.map((item) => (
                <li
                  key={`notification-${item.id}`}
                  data-read={Boolean(item.readAt)}
                >
                  <button
                    type="button"
                    onClick={async () => {
                      if (await markRead(item)) {
                        setOpen(false);
                        router.push(destination(item));
                      }
                    }}
                  >
                    <small>
                      {item.actorName ??
                        (item.type.startsWith("chat")
                          ? "Conversa"
                          : "OpenStudyHub")}{" "}
                      ·{" "}
                      {new Intl.DateTimeFormat("pt-BR", {
                        dateStyle: "short",
                        timeStyle: "short",
                      }).format(item.createdAt)}
                    </small>
                    <b>{item.title}</b>
                    {item.bodyPreview ? <span>{item.bodyPreview}</span> : null}
                    <small>
                      <UiCopy pt="Ver detalhes →" en="View details →" />
                    </small>
                  </button>
                </li>
              ))}
            </ol>
          ) : (
            <span>
              <UiCopy pt="Nenhuma notificação." en="No notifications." />
            </span>
          )}
        </div>
      ) : null}
    </div>
  );
}
