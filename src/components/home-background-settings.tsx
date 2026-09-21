"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

export function HomeBackgroundSettings({
  configured,
}: {
  configured: boolean;
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
            Remover imagem
          </button>
        ) : null}
      </div>
      <small>
        PNG, JPEG ou WebP · máximo 5 MiB · somente no canvas da Home.
      </small>
      {state === "loading" ? (
        <span role="status">Processando imagem…</span>
      ) : null}
      {state === "error" ? (
        <span className="form-error" role="alert">
          Imagem inválida ou acima do limite.
        </span>
      ) : null}
    </div>
  );
}
