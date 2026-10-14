"use client";
import { useState } from "react";
import { shortcutIconPresets } from "@/lib/shortcut-icon-catalog";
import { ShortcutPresetIcon } from "./shortcut-icon";
import { UiCopy, useUiText } from "./ui-language-provider";
export function ShortcutIconPicker({
  initial = null,
}: {
  initial?: string | null;
}) {
  const tr = useUiText();
  const [choice, setChoice] = useState(initial?.startsWith("@") ? initial : "");
  return (
    <fieldset className="shortcut-icon-picker">
      <legend>
        <UiCopy pt="Ícone do atalho" en="Shortcut icon" />
      </legend>
      <input type="hidden" name="icon" value={choice} />
      <div className="shortcut-icon-modes">
        <button
          type="button"
          aria-pressed={choice === ""}
          onClick={() => setChoice("")}
        >
          {tr("Automático pelo link", "Automatic from link")}
        </button>
        <button
          type="button"
          aria-pressed={choice === "@site"}
          onClick={() => setChoice("@site")}
        >
          {tr("Ícone do site", "Site icon")}
        </button>
      </div>
      <div className="shortcut-icon-preset-grid">
        {shortcutIconPresets.map((p) => (
          <button
            key={p.id}
            type="button"
            title={p.label}
            aria-label={p.label}
            aria-pressed={choice === `@${p.id}`}
            onClick={() => setChoice(`@${p.id}`)}
          >
            <ShortcutPresetIcon preset={p.id} />
          </button>
        ))}
      </div>
      <small>
        {tr(
          "Links conhecidos usam estes ícones. Ícone do site busca o favicon pelo pipeline seguro; se indisponível, aparece a sigla.",
          "Known links use these icons. Site icon retrieves the favicon through the safe pipeline; an abbreviation appears if unavailable.",
        )}
      </small>
    </fieldset>
  );
}
