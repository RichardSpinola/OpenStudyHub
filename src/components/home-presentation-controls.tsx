"use client";
import { useState, useTransition } from "react";
import { useUiText } from "./ui-language-provider";
import { HomeFramingDialog } from "./home-framing-dialog";
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
  const [draft, setDraft] = useState(initial),
    [framing, setFraming] = useState(false),
    [pending, startTransition] = useTransition(),
    [status, setStatus] = useState("");
  const tr = useUiText();
  const image = /^custom:[1-9]\d*$/.test(catalog.selected)
    ? `/api/home-background?wallpaperId=${catalog.selected.slice(7)}`
    : catalog.selected === "legacy"
      ? "/api/home-background"
      : null;
  function save(next: HomePresentation) {
    const previous = draft;
    setDraft(next);
    setStatus(tr("Salvando…", "Saving…"));
    startTransition(async () => {
      try {
        const form = new FormData();
        for (const [key, value] of Object.entries(next))
          form.set(key, value === null ? "" : String(value));
        await updateHomePresentationAction(form);
        setStatus(tr("Salvo automaticamente.", "Saved automatically."));
      } catch {
        setDraft(previous);
        setStatus(
          tr(
            "Não foi possível salvar. Tente novamente.",
            "Could not save. Try again.",
          ),
        );
      }
    });
  }
  return (
    <section className="home-presentation-controls">
      <h3>{tr("Imagem e fonte pessoal", "Image and personal font")}</h3>
      {image ? (
        <>
          <div
            className="home-wallpaper-crop-preview"
            role="img"
            aria-label={tr("Prévia do fundo", "Background preview")}
            style={{
              backgroundImage: `url(${image})`,
              backgroundPosition: `${draft.wallpaperX}% ${draft.wallpaperY}%`,
              backgroundSize: draft.wallpaperFit,
            }}
          />
          <div className="panel-actions">
            <button
              type="button"
              disabled={pending}
              onClick={() => setFraming(true)}
            >
              {tr("Enquadrar imagem", "Frame image")}
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() =>
                save({
                  ...draft,
                  wallpaperFit: "contain",
                  wallpaperZoom: 1,
                  wallpaperX: 50,
                  wallpaperY: 50,
                })
              }
            >
              {tr("Mostrar imagem inteira", "Show whole image")}
            </button>
          </div>
        </>
      ) : null}
      <label>
        {tr("Fonte do título ASCII", "ASCII title font")}
        <select
          name="asciiFont"
          value={draft.asciiFont ?? ""}
          disabled={pending}
          onChange={(e) =>
            save({
              ...draft,
              asciiFont: (e.target.value ||
                null) as HomePresentation["asciiFont"],
            })
          }
        >
          <option value="">
            {tr("Padrão da instância", "Instance default")}
          </option>
          {figletFontOptions.map((font) => (
            <option key={font}>{font}</option>
          ))}
        </select>
      </label>
      <p>
        {tr(
          "A fonte é pessoal. O texto do título é definido pelo Admin.",
          "The font is personal. Title text is set by Admin.",
        )}
      </p>
      <small role="status" aria-live="polite">
        {status}
      </small>
      {framing && image ? (
        <HomeFramingDialog
          source={image}
          initial={draft}
          onCancel={() => setFraming(false)}
          onApply={(next) => {
            setFraming(false);
            save(next);
          }}
        />
      ) : null}
    </section>
  );
}
