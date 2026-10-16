"use client";
import { useEffect, useState } from "react";
import { UiCopy } from "@/components/ui-language-provider";

export function GameSoundSettings({ userId }: { userId: number }) {
  const [enabled, setEnabled] = useState(false);
  const [status, setStatus] = useState("");
  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        setEnabled(localStorage.getItem(`osh:game-sound:${userId}`) === "1");
      } catch {}
    }, 0);
    return () => clearTimeout(timer);
  }, [userId]);
  return (
    <fieldset className="game-sound-settings">
      <legend>
        <UiCopy pt="Celebração nos jogos" en="Game celebrations" />
      </legend>
      <label className="checkbox-label">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => {
            const next = e.target.checked;
            try {
              localStorage.setItem(
                `osh:game-sound:${userId}`,
                next ? "1" : "0",
              );
              setEnabled(next);
              setStatus("saved");
              window.dispatchEvent(new Event("osh:game-sound"));
            } catch {
              setStatus("error");
            }
          }}
        />
        <UiCopy pt="Som ao vencer" en="Victory sound" />
      </label>
      <p className="tool-muted">
        <UiCopy
          pt="Vale para todos os jogos desta conta neste navegador. O confete acompanha as vitórias e respeita a redução de movimento."
          en="Applies to all games for this account in this browser. Victory confetti respects reduced motion."
        />
      </p>
      <p role="status">
        {status === "saved" ? (
          <UiCopy
            pt="Preferência salva automaticamente."
            en="Preference saved automatically."
          />
        ) : status === "error" ? (
          <UiCopy
            pt="Não foi possível salvar neste navegador."
            en="Could not save in this browser."
          />
        ) : null}
      </p>
    </fieldset>
  );
}
