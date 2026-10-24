"use client";
import { useUiText } from "@/components/ui-language-provider";
export type ChatAiReply = {
  id: string;
  content: string;
  status: string;
  human_message_id: number;
  created_at: number;
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
  if (!state?.enabled) return null;
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
      {state.permission && (
        <small>
          {t(
            "Mencione @IA para pedir uma resposta com o contexto desta conversa.",
            "Mention @IA to request a reply using this conversation's context.",
          )}
        </small>
      )}
    </div>
  );
}
