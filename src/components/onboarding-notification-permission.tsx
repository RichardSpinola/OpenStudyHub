"use client";
import { UiCopy, useUiLanguage, useUiText } from "@/components/ui-language-provider";
import { localizePushStatus } from "@/lib/translations";

import { useState } from "react";
import { enableBrowserPush } from "@/lib/push-client";

export function OnboardingNotificationPermission({
  onEnabled,
  onSkipped,
}: {
  onEnabled: () => void;
  onSkipped: () => void;
}) {
  const language = useUiLanguage();
  const tr = useUiText();
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <div className="onboarding-notification-choice">
      <p>
        <UiCopy
          pt="Receba avisos de mensagens e menções, além de atividades importantes quando disponíveis. Você pode mudar isso depois nas Configurações."
          en="Get alerts for messages and mentions, plus important activities when available. You can change this later in Settings."
        />
      </p>
      <div className="compact-actions">
        <button
          type="button"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              const message = await enableBrowserPush();
              setStatus(localizePushStatus(language, message));
              if (message.startsWith("Notificações ativadas")) onEnabled();
            } catch {
              setStatus(tr("Não foi possível ativar agora.", "Could not enable notifications now."));
            } finally {
              setBusy(false);
            }
          }}
        >
          <UiCopy pt="Ativar notificações" en="Enable notifications" />
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => {
            onSkipped();
            setStatus(tr("Você pode ativar depois.", "You can enable them later."));
          }}
        >
          <UiCopy pt="Agora não" en="Not now" />
        </button>
      </div>
      <small role="status" aria-live="polite">
        {busy ? tr("Aguarde…", "Please wait…") : status}
      </small>
    </div>
  );
}
