"use client";
import {
  UiCopy,
  useUiLanguage,
  useUiText,
} from "@/components/ui-language-provider";
import { localizePushStatus } from "@/lib/translations";

import { useState } from "react";
import { disableBrowserPush, enableBrowserPush } from "@/lib/push-client";

export function PushControls({ onEnabled }: { onEnabled?: () => void }) {
  const language = useUiLanguage();
  const tr = useUiText();
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  async function run(action: "enable" | "disable") {
    setBusy(true);
    try {
      const message =
        action === "enable"
          ? await enableBrowserPush()
          : await disableBrowserPush();
      setStatus(localizePushStatus(language, message));
      if (action === "enable" && message.startsWith("Notificações ativadas"))
        onEnabled?.();
    } catch {
      setStatus(
        tr(
          "Não foi possível concluir. Tente novamente.",
          "Could not complete the operation. Try again.",
        ),
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="push-controls">
      <div className="compact-actions">
        <button
          type="button"
          disabled={busy}
          onClick={() => void run("enable")}
        >
          <UiCopy pt="Ativar notificações" en="Enable notifications" />
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => void run("disable")}
        >
          <UiCopy
            pt="Desativar neste dispositivo"
            en="Disable on this device"
          />
        </button>
      </div>
      <small role="status" aria-live="polite">
        {busy ? tr("Aguarde…", "Please wait…") : status}
      </small>
    </div>
  );
}
