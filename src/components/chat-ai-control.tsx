"use client";
import { useEffect, useState } from "react";
import { IconX } from "@tabler/icons-react";
import { useUiText } from "@/components/ui-language-provider";
const HINT_KEY = "osh-chat-ai-hint-seen";
export type ChatAiReply = {
  id: string;
  content: string;
  status: string;
  human_message_id: number;
  created_at: number;
  model?: string | null;
};
export function ChatAiControl({
  roomId,
  state,
  onChange,
}: {
  roomId: number;
  state: {
    enabled: boolean;
    groupEnabled: boolean;
    permission: boolean;
    canConfigure: boolean;
  } | null;
  onChange: () => void;
}) {
  const t = useUiText();
  const [hint, setHint] = useState(true);
  const showHint = !!state?.permission;
  useEffect(() => {
    if (!showHint) return;
    // Shown once per browser: hidden at once if already seen, otherwise after a few seconds.
    let seen = false;
    try {
      seen = localStorage.getItem(HINT_KEY) === "1";
      localStorage.setItem(HINT_KEY, "1");
    } catch {
      /* Private mode: hide after the delay only. */
    }
    const timer = setTimeout(() => setHint(false), seen ? 0 : 8000);
    return () => clearTimeout(timer);
  }, [showHint]);
  if (!state?.enabled) return null;
  if (!(state.groupEnabled && state.canConfigure) && !(showHint && hint))
    return null;
  return (
    <div className="chat-ai-control">
      {state.groupEnabled && state.canConfigure && (
        <label>
          <input
            type="checkbox"
            checked={state.permission}
            onChange={async (e) => {
              const response = await fetch("/api/ai/room", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ roomId, enabled: e.target.checked }),
              });
              if (response.ok) onChange();
            }}
          />
          {t("Permitir @IA neste grupo", "Allow @IA in this group")}
        </label>
      )}
      {showHint && hint && (
        <small>
          {t(
            "Mencione @IA para pedir uma resposta com o contexto desta conversa.",
            "Mention @IA to request a reply using this conversation's context.",
          )}
          <button
            type="button"
            className="chat-ai-hint-close"
            aria-label={t("Fechar aviso", "Dismiss notice")}
            onClick={() => setHint(false)}
          >
            <IconX size={14} />
          </button>
        </small>
      )}
    </div>
  );
}
