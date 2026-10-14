"use client";
import { useState, useTransition } from "react";
import { useUiText } from "./ui-language-provider";
import { updateHomeControlAction } from "@/app/settings/actions";
export function HomeControlSettings({ enabled }: { enabled: boolean }) {
  const [checked, setChecked] = useState(enabled),
    [pending, start] = useTransition(),
    [error, setError] = useState(false),
    tr = useUiText();
  return (
    <div className="home-control-settings">
      <label className="checkbox-label">
        <input
          type="checkbox"
          checked={checked}
          disabled={pending}
          onChange={(e) => {
            const next = e.target.checked;
            setChecked(next);
            setError(false);
            start(async () => {
              try {
                const form = new FormData();
                form.set("controlEnabled", String(next));
                await updateHomeControlAction(form);
              } catch {
                setChecked(!next);
                setError(true);
              }
            });
          }}
        />
        {tr(
          "Mostrar lápis de personalização na Home",
          "Show customization pencil on Home",
        )}
      </label>
      <p>
        {tr(
          "Arraste o lápis para posicioná-lo. As configurações continuam disponíveis aqui quando ele estiver oculto.",
          "Drag the pencil to position it. Settings remain available here when it is hidden.",
        )}
      </p>
      <small role="status">
        {error
          ? tr(
              "Não foi possível salvar. Tente novamente.",
              "Could not save. Try again.",
            )
          : pending
            ? tr("Salvando…", "Saving…")
            : ""}
      </small>
    </div>
  );
}
