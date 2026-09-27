"use client";
import { UiCopy } from "@/components/ui-language-provider";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

import type { WallpaperCatalog } from "@/lib/home-wallpapers";

const presets = [
  { id: "none", label: "Sem imagem" },
  { id: "grid", label: "Grade" },
  { id: "horizon", label: "Horizonte" },
  { id: "paper", label: "Papel" },
] as const;

export function HomeWallpaperPicker({
  catalog,
  limitMiB,
}: {
  catalog: WallpaperCatalog;
  limitMiB: 5 | 10;
}) {
  const input = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const [state, setState] = useState<"idle" | "loading" | "error">("idle");

  async function upload(file: File | null) {
    if (!file) return;
    setState("loading");
    const data = new FormData();
    data.set("background", file);
    try {
      const response = await fetch("/api/home-background", {
        method: "POST",
        body: data,
      });
      setState(response.ok ? "idle" : "error");
      if (response.ok) router.refresh();
    } catch {
      setState("error");
    }
    if (input.current) input.current.value = "";
  }

  async function choose(choice: string) {
    setState("loading");
    const data = new FormData();
    data.set("choice", choice);
    try {
      const response = await fetch("/api/home-background", {
        method: "POST",
        body: data,
      });
      setState(response.ok ? "idle" : "error");
      if (response.ok) router.refresh();
    } catch {
      setState("error");
    }
  }

  async function remove(wallpaperId: number | "legacy") {
    setState("loading");
    try {
      const response = await fetch(
        `/api/home-background?wallpaperId=${wallpaperId}`,
        { method: "DELETE" },
      );
      setState(response.ok ? "idle" : "error");
      if (response.ok) router.refresh();
    } catch {
      setState("error");
    }
  }

  return (
    <div className="home-background-settings">
      <input
        ref={input}
        className="sr-only"
        type="file"
        accept="image/png,image/jpeg,image/webp"
        aria-label="Escolher imagem para a Home"
        onChange={(event) => void upload(event.target.files?.item(0) ?? null)}
      />
      <div className="wallpaper-choices">
        {presets.map((preset) => (
          <button
            key={preset.id}
            type="button"
            className="wallpaper-choice"
            data-preset={preset.id}
            aria-pressed={catalog.selected === preset.id}
            onClick={() => void choose(preset.id)}
          >
            <span className="wallpaper-thumbnail" aria-hidden="true" />
            <span>{preset.label}</span>
          </button>
        ))}
        {catalog.selected === "legacy" ? (
          <div className="wallpaper-personal">
            <span className="wallpaper-choice" aria-current="true">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/api/home-background" alt="" />
              <span>
                <UiCopy pt="Imagem atual" en="Current image" />
              </span>
            </span>
            <button
              type="button"
              className="wallpaper-remove"
              onClick={() => void remove("legacy")}
            >
              <UiCopy pt="Remover" en="Remove" />
            </button>
          </div>
        ) : null}
        {catalog.wallpapers.map((wallpaper) => (
          <div className="wallpaper-personal" key={wallpaper.id}>
            <button
              type="button"
              className="wallpaper-choice"
              aria-pressed={catalog.selected === `custom:${wallpaper.id}`}
              onClick={() => void choose(`custom:${wallpaper.id}`)}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`/api/home-background?wallpaperId=${wallpaper.id}`}
                alt=""
              />
              <span>
                <UiCopy pt="Imagem pessoal" en="Personal image" />
              </span>
            </button>
            <button
              type="button"
              className="wallpaper-remove"
              onClick={() => void remove(wallpaper.id)}
              aria-label={`Remover imagem pessoal ${wallpaper.id}`}
            >
              <UiCopy pt="Remover" en="Remove" />
            </button>
          </div>
        ))}
        <button
          type="button"
          className="wallpaper-choice wallpaper-add"
          onClick={() => input.current?.click()}
        >
          <span className="wallpaper-thumbnail" aria-hidden="true">
            +
          </span>
          <span>
            <UiCopy pt="Adicionar imagem" en="Add image" />
          </span>
        </button>
      </div>
      <small>
        <UiCopy pt="PNG, JPEG ou WebP · até" en="PNG, JPEG or WebP · up to" />{" "}
        {limitMiB}
        <UiCopy
          pt="MiB · últimas 3 imagens pessoais."
          en="MiB · last 3 personal images."
        />
      </small>
      {state === "loading" ? (
        <span role="status">
          <UiCopy pt="Salvando fundo…" en="Saving background…" />
        </span>
      ) : null}
      {state === "error" ? (
        <span className="form-error" role="alert">
          <UiCopy
            pt="Não foi possível alterar o fundo. Confira a imagem e tente de novo."
            en="The background could not be changed. Check the image and try again."
          />
        </span>
      ) : null}
    </div>
  );
}
