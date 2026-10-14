"use client";
import { useState, useTransition } from "react";
import { UiCopy, useUiText } from "./ui-language-provider";
import { figletFontOptions } from "@/lib/ascii-fonts";
import type { HomePresentation } from "@/lib/home-presentation";
import type { WallpaperCatalog } from "@/lib/home-wallpapers";
import { updateHomePresentationAction } from "@/app/settings/actions";

export function HomePresentationControls({
  initial,
  catalog,
}: {
  initial: HomePresentation;
  catalog: WallpaperCatalog;
}) {
  const [draft, setDraft] = useState(initial);
  const [pending, startTransition] = useTransition();
  const [status, setStatus] = useState("");
  const tr = useUiText();
  const image = /^custom:[1-9]\d*$/.test(catalog.selected)
    ? `/api/home-background?wallpaperId=${catalog.selected.slice(7)}`
    : catalog.selected === "legacy"
      ? "/api/home-background"
      : null;
  return (
    <section className="home-presentation-controls">
      <h3>
        <UiCopy
          pt="Enquadramento e fonte pessoal"
          en="Framing and personal font"
        />
      </h3>
      <form
        onReset={(event) => event.preventDefault()}
        action={(form) =>
          startTransition(async () => {
            try {
              await updateHomePresentationAction(form);
              setStatus(tr("Preferências salvas.", "Preferences saved."));
            } catch {
              setStatus(
                tr(
                  "Não foi possível salvar. Tente novamente.",
                  "Could not save. Try again.",
                ),
              );
            }
          })
        }
      >
        {image ? (
          <div
            className="home-wallpaper-crop-preview"
            role="img"
            aria-label={tr("Prévia do enquadramento", "Framing preview")}
            style={{
              backgroundImage: `url(${image})`,
              backgroundPosition: `${draft.wallpaperX}% ${draft.wallpaperY}%`,
              backgroundSize: draft.wallpaperFit,
            }}
          />
        ) : null}
        <label>
          <UiCopy pt="Enquadramento da imagem" en="Image fit" />
          <select
            name="wallpaperFit"
            value={draft.wallpaperFit}
            onChange={(event) =>
              setDraft({
                ...draft,
                wallpaperFit: event.target
                  .value as HomePresentation["wallpaperFit"],
              })
            }
          >
            <option value="cover">{tr("Preencher a Home", "Fill Home")}</option>
            <option value="contain">
              {tr("Mostrar imagem inteira", "Show whole image")}
            </option>
          </select>
        </label>
        <label>
          <UiCopy pt="Posição horizontal" en="Horizontal position" />
          <input
            name="wallpaperX"
            type="range"
            min="0"
            max="100"
            value={draft.wallpaperX}
            onChange={(event) =>
              setDraft({ ...draft, wallpaperX: Number(event.target.value) })
            }
          />
          <output>{draft.wallpaperX}%</output>
        </label>
        <label>
          <UiCopy pt="Posição vertical" en="Vertical position" />
          <input
            name="wallpaperY"
            type="range"
            min="0"
            max="100"
            value={draft.wallpaperY}
            onChange={(event) =>
              setDraft({ ...draft, wallpaperY: Number(event.target.value) })
            }
          />
          <output>{draft.wallpaperY}%</output>
        </label>
        <label>
          <UiCopy pt="Fonte do título ASCII" en="ASCII title font" />
          <select
            name="asciiFont"
            value={draft.asciiFont ?? ""}
            onChange={(event) =>
              setDraft({
                ...draft,
                asciiFont: (event.target.value ||
                  null) as HomePresentation["asciiFont"],
              })
            }
          >
            <option value="">
              {tr("Padrão da instância", "Instance default")}
            </option>
            {figletFontOptions.map((font) => (
              <option key={font} value={font}>
                {font}
              </option>
            ))}
          </select>
        </label>
        <p>
          <UiCopy
            pt="A fonte é pessoal. O texto do título é definido pelo Admin."
            en="The font is personal. The title text is set by the Admin."
          />
        </p>
        <button type="submit" disabled={pending}>
          {pending
            ? tr("Salvando…", "Saving…")
            : tr("Salvar aparência da Home", "Save Home appearance")}
        </button>
        <small role="status" aria-live="polite">
          {status}
        </small>
      </form>
    </section>
  );
}
