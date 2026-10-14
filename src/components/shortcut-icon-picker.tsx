"use client";
import { useRef, useState } from "react";
import { shortcutIconPresets } from "@/lib/shortcut-icon-catalog";
import { ShortcutPresetIcon } from "./shortcut-icon";
import { useUiText } from "./ui-language-provider";
export function ShortcutIconPicker({
  initial = null,
}: {
  initial?: string | null;
}) {
  const tr = useUiText(),
    [choice, setChoice] = useState(
      initial?.startsWith("@") ? initial : "@text",
    ),
    [image, setImage] = useState(""),
    [previewUrl, setPreviewUrl] = useState(""),
    [status, setStatus] = useState(""),
    [search, setSearch] = useState("");
  const root = useRef<HTMLFieldSetElement>(null),
    dialog = useRef<HTMLDialogElement>(null),
    requestId = useRef(0);
  const custom = choice !== "@text" && choice !== "@site";
  async function preview() {
    const n = ++requestId.current;
    const url =
      (
        root.current
          ?.closest("form")
          ?.querySelector('[name="url"]') as HTMLInputElement
      )?.value ?? "";
    setImage("");
    setStatus(tr("Buscando ícone…", "Finding icon…"));
    try {
      const r = await fetch(
        window.location.pathname.startsWith("/control")
          ? "/control/shortcut-icon-preview"
          : "/api/shortcut-icon/preview",
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ url }),
        },
      );
      const data = await r.json();
      if (n !== requestId.current) return;
      if (!r.ok) throw new Error(data.error ?? "Icon search failed");
      setImage(data.image ?? "");
      setPreviewUrl(url);
      setStatus(
        data.image
          ? tr("Ícone encontrado.", "Icon found.")
          : tr(
              "Não foi encontrado um ícone. Escolha um personalizado ou envie uma imagem.",
              "No icon was found. Choose a preset or upload an image.",
            ),
      );
    } catch {
      if (n === requestId.current)
        setStatus(
          tr(
            "Não foi possível buscar. Tente novamente.",
            "Could not search. Try again.",
          ),
        );
    }
  }
  function mode(value: string) {
    requestId.current++;
    setChoice(value);
    setImage("");
    setStatus("");
  }
  return (
    <fieldset className="shortcut-icon-picker" ref={root}>
      <legend>{tr("Ícone do atalho", "Shortcut icon")}</legend>
      <input type="hidden" name="icon" value={choice} />
      <input type="hidden" name="iconPreviewUrl" value={previewUrl} />
      <input
        type="hidden"
        name="iconPreview"
        value={choice === "@site" ? image : ""}
      />
      <div className="shortcut-icon-modes">
        <button
          type="button"
          aria-pressed={choice === "@text"}
          onClick={() => mode("@text")}
        >
          {tr("Abreviação", "Abbreviation")}
        </button>
        <button
          type="button"
          aria-pressed={choice === "@site"}
          onClick={() => mode("@site")}
        >
          {tr("Ícone do site", "Site icon")}
        </button>
        <button
          type="button"
          aria-pressed={custom}
          onClick={() => {
            if (!custom) mode("@web");
            dialog.current?.showModal();
          }}
        >
          {tr("Personalizado", "Custom")}
        </button>
      </div>
      {choice === "@site" && (
        <div className="shortcut-icon-preview">
          <button type="button" onClick={preview}>
            {tr("Buscar e visualizar", "Find and preview")}
          </button>
          {image && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={image}
              alt={tr("Prévia do ícone encontrado", "Found icon preview")}
              width={48}
              height={48}
            />
          )}
          <p role="status">
            {status ||
              tr(
                "Informe o endereço do atalho e busque a imagem do site.",
                "Enter the shortcut address and find its icon.",
              )}
          </p>
        </div>
      )}
      {custom && (
        <div className="shortcut-custom-choice">
          {image && choice === "@image" && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={image}
              alt={tr("Prévia da imagem enviada", "Uploaded image preview")}
              width={48}
              height={48}
            />
          )}{" "}
          {choice !== "@image" && (
            <span className="shortcut-selected-preset">
              <ShortcutPresetIcon preset={choice.slice(1)} />
              {
                shortcutIconPresets.find((preset) => "@" + preset.id === choice)
                  ?.label
              }
            </span>
          )}
          <button type="button" onClick={() => dialog.current?.showModal()}>
            {tr("Escolher no catálogo", "Choose from catalog")}
          </button>
          <label>
            {tr(
              "Ou enviar sua imagem — até 2 MB",
              "Or upload your image — up to 2 MB",
            )}
            <input
              name="iconFile"
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={(e) => {
                const file = e.target.files?.[0];
                setStatus("");
                if (!file) return;
                if (file.size > 2 * 1024 * 1024) {
                  e.target.value = "";
                  setStatus(
                    tr(
                      "A imagem deve ter até 2 MB.",
                      "The image must be at most 2 MB.",
                    ),
                  );
                  return;
                }
                setChoice("@image");
                const reader = new FileReader();
                reader.onload = () => setImage(String(reader.result));
                reader.readAsDataURL(file);
              }}
            />
          </label>
          <p role="status">{status}</p>
        </div>
      )}
      <dialog
        ref={dialog}
        className="shortcut-catalog-dialog"
        aria-label={tr("Catálogo de ícones", "Icon catalog")}
        onClose={(event) => event.stopPropagation()}
        onClick={(e) => {
          if (e.target === dialog.current) dialog.current?.close();
        }}
      >
        <header>
          <h3>{tr("Catálogo de ícones", "Icon catalog")}</h3>
          <button
            type="button"
            aria-label={tr("Fechar catálogo", "Close catalog")}
            onClick={() => dialog.current?.close()}
          >
            ×
          </button>
        </header>
        <label>
          {tr("Buscar ícone", "Find icon")}
          <input value={search} onChange={(e) => setSearch(e.target.value)} />
        </label>
        <div className="shortcut-icon-preset-grid">
          {shortcutIconPresets
            .filter((p) => p.label.toLowerCase().includes(search.toLowerCase()))
            .map((p) => (
              <button
                key={p.id}
                type="button"
                title={p.label}
                aria-label={p.label}
                aria-pressed={choice === "@" + p.id}
                onClick={() => {
                  mode("@" + p.id);
                  dialog.current?.close();
                }}
              >
                <ShortcutPresetIcon preset={p.id} />
                <small>{p.label}</small>
              </button>
            ))}
        </div>
      </dialog>
    </fieldset>
  );
}
