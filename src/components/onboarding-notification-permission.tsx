"use client";

import { useEffect, useState } from "react";

export function OnboardingNotificationPermission() {
  const [permission, setPermission] = useState<
    NotificationPermission | "unsupported" | "loading"
  >("loading");

  useEffect(() => {
    const timer = window.setTimeout(
      () =>
        setPermission(
          typeof Notification === "undefined"
            ? "unsupported"
            : Notification.permission,
        ),
      0,
    );
    return () => window.clearTimeout(timer);
  }, []);

  if (permission === "loading") return <span>Verificando notificações…</span>;

  if (permission === "unsupported") {
    return <span>Este navegador não oferece notificações do sistema.</span>;
  }

  if (permission === "granted") {
    return (
      <div className="compact-actions">
        <span>Notificações permitidas.</span>
        <button
          type="button"
          onClick={() =>
            new Notification("OpenStudyHub", {
              body: "As notificações estão funcionando.",
            })
          }
        >
          Testar notificação
        </button>
      </div>
    );
  }

  if (permission === "denied") {
    return (
      <span>
        Notificações estão bloqueadas. Altere a permissão deste site no
        navegador.
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={async () =>
        setPermission(await Notification.requestPermission())
      }
    >
      Permitir notificações do sistema
    </button>
  );
}
