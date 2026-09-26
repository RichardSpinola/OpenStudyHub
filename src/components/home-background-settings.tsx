"use client";
import { UiCopy } from "@/components/ui-language-provider";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import type { WallpaperCatalog } from "@/lib/home-wallpapers";
import { HomeWallpaperPicker } from "@/components/home-wallpaper-picker";

export function HomeBackgroundSettings({
  configured,
  catalog,
  wallpaperLimitMiB,
}: {
  configured: boolean;
  catalog?: WallpaperCatalog;
  wallpaperLimitMiB?: 5 | 10;
}) {
  const input = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const [state, setState] = useState<"idle" | "loading" | "error">("idle");

  async function upload(file: File | null) {
    if (!file) return;
    setState("loading");
    const data = new FormData();
    data.set("background", file);
    const response = await fetch("/api/home-background", {
      method: "POST",
      body: data,
    });
    if (!response.ok) {
      setState("error");
      return;
    }
    setState("idle");
    router.refresh();
  }

  async function remove() {
    setState("loading");
    const response = await fetch("/api/home-background", { method: "DELETE" });
    setState(response.ok ? "idle" : "error");
    if (response.ok) router.refresh();
  }

  if (catalog)
    return (
      <HomeWallpaperPicker
        catalog={catalog}
        limitMiB={wallpaperLimitMiB ?? 10}
      />
    );

  return (
    <div className="home-background-settings">
      <input
        ref={input}
        className="sr-only"
        type="file"
        accept="image/png,image/jpeg,image/webp"
        onChange={(event) => void upload(event.target.files?.item(0) ?? null)}
      />
      <div className="panel-actions">
        <button type="button" onClick={() => input.current?.click()}>
          {configured ? "Substituir imagem" : "Adicionar imagem"}
        </button>
        {configured ? (
          <button
            type="button"
            className="secondary-button"
            onClick={() => void remove()}
          >
            <UiCopy pt="Remover imagem" en="Remove image" />
          </button>
        ) : null}
      </div>
      <small>
        <UiCopy
          pt="PNG, JPEG ou WebP · máximo 10 MiB · somente no canvas da Home."
          en="PNG, JPEG or WebP · maximum 10 MiB · only on the Home canvas."
        />
      </small>
      {state === "loading" ? (
        <span role="status">
          <UiCopy pt="Processando imagem…" en="Processing image…" />
        </span>
      ) : null}
      {state === "error" ? (
        <span className="form-error" role="alert">
          <UiCopy
            pt="Imagem inválida ou acima do limite."
            en="Invalid image or size limit exceeded."
          />
        </span>
      ) : null}
    </div>
  );
}
