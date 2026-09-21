"use client";

import { useState } from "react";

export function ProfileMediaSettings({
  userId,
  hasAvatar,
  hasBanner,
}: {
  userId: number;
  hasAvatar: boolean;
  hasBanner: boolean;
}) {
  const [version, setVersion] = useState(0);
  const [status, setStatus] = useState("");
  const [present, setPresent] = useState({
    avatar: hasAvatar,
    banner: hasBanner,
  });

  async function upload(kind: "avatar" | "banner", form: HTMLFormElement) {
    setStatus("Salvando…");
    const response = await fetch(`/api/profile-media/${userId}/${kind}`, {
      method: "POST",
      body: new FormData(form),
    });
    setStatus(response.ok ? "Imagem salva." : "Imagem inválida.");
    if (response.ok) {
      setPresent((current) => ({ ...current, [kind]: true }));
      setVersion((current) => current + 1);
      form.reset();
    }
  }

  async function remove(kind: "avatar" | "banner") {
    const response = await fetch(`/api/profile-media/${userId}/${kind}`, {
      method: "DELETE",
    });
    setStatus(response.ok ? "Imagem removida." : "Não foi possível remover.");
    if (response.ok) {
      setPresent((current) => ({ ...current, [kind]: false }));
      setVersion((current) => current + 1);
    }
  }

  return (
    <div className="profile-media-settings">
      {(["avatar", "banner"] as const).map((kind) => {
        const isAvatar = kind === "avatar";
        const isPresent = present[kind];
        return (
          <form
            key={kind}
            className={`profile-media-form profile-media-${kind}`}
            onSubmit={(event) => {
              event.preventDefault();
              void upload(kind, event.currentTarget);
            }}
          >
            <label className="profile-media-picker">
              <span>{isAvatar ? "Avatar" : "Banner"}</span>
              <span
                className={`profile-media-preview ${isAvatar ? "is-avatar" : "is-banner"}`}
              >
                {isPresent ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={`/api/profile-media/${userId}/${kind}?v=${version}`}
                    alt=""
                  />
                ) : (
                  <span aria-hidden="true">+</span>
                )}
                <span className="profile-media-overlay">
                  {isPresent ? "Trocar" : "Escolher"}
                </span>
              </span>
              <input
                name="image"
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={(event) => {
                  if (event.target.files?.[0]) {
                    setStatus(
                      `${isAvatar ? "Avatar" : "Banner"} selecionado. Clique em salvar.`,
                    );
                  }
                }}
                required
              />
            </label>
            <div className="compact-actions profile-media-actions">
              <button type="submit">Salvar</button>
              {isPresent ? (
                <button
                  className="secondary-button"
                  type="button"
                  onClick={() => void remove(kind)}
                >
                  Remover
                </button>
              ) : null}
            </div>
          </form>
        );
      })}
      {status ? <span role="status">{status}</span> : null}
    </div>
  );
}
