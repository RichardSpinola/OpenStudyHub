"use client";
import { UiCopy, useUiText } from "@/components/ui-language-provider";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ProfileCropDialog } from "@/components/profile-crop-dialog";

type Kind = "avatar" | "banner";
type Crop = { x: number; y: number; width: number; height: number };

export function ProfileMediaSettings({
  userId,
  hasAvatar,
  hasBanner,
}: {
  userId: number;
  hasAvatar: boolean;
  hasBanner: boolean;
}) {
  const tr = useUiText();
  const router = useRouter();
  const [version, setVersion] = useState(0);
  const [status, setStatus] = useState("");
  const [pending, setPending] = useState<Kind | null>(null);
  const [activeCrop, setActiveCrop] = useState<Kind | null>(null);
  const [present, setPresent] = useState({
    avatar: hasAvatar,
    banner: hasBanner,
  });
  const [files, setFiles] = useState<Record<Kind, File | null>>({
    avatar: null,
    banner: null,
  });
  const [previews, setPreviews] = useState<Record<Kind, string | null>>({
    avatar: null,
    banner: null,
  });
  const previewUrls = useRef<Record<Kind, string | null>>({
    avatar: null,
    banner: null,
  });

  useEffect(
    () => () => {
      Object.values(previewUrls.current).forEach((url) => {
        if (url) URL.revokeObjectURL(url);
      });
    },
    [],
  );

  function cancelCrop(kind: Kind) {
    const preview = previewUrls.current[kind];
    if (preview) URL.revokeObjectURL(preview);
    previewUrls.current[kind] = null;
    setPreviews((current) => ({ ...current, [kind]: null }));
    setFiles((current) => ({ ...current, [kind]: null }));
    setActiveCrop(null);
    setStatus(tr("Recorte cancelado.", "Crop cancelled."));
  }

  async function upload(kind: Kind, crop: Crop) {
    const file = files[kind];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      setStatus(
        tr("A imagem precisa ter até 10 MiB.", "Image must be up to 10 MiB."),
      );
      return;
    }
    setPending(kind);
    setStatus(
      tr("Preparando e salvando imagem…", "Preparing and saving image…"),
    );
    try {
      const image = await createImageBitmap(file);
      const canvas = document.createElement("canvas");
      canvas.width = kind === "avatar" ? 640 : 1500;
      canvas.height = kind === "avatar" ? 640 : 500;
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Canvas unavailable");
      context.drawImage(
        image,
        crop.x,
        crop.y,
        crop.width,
        crop.height,
        0,
        0,
        canvas.width,
        canvas.height,
      );
      image.close();
      const blob = await new Promise<Blob>((resolve, reject) =>
        canvas.toBlob(
          (value) =>
            value
              ? resolve(value)
              : reject(new Error("Image conversion failed")),
          "image/jpeg",
          0.9,
        ),
      );
      if (blob.size > 5 * 1024 * 1024)
        throw new Error(
          tr(
            "A imagem recortada ficou acima de 5 MiB.",
            "Cropped image exceeded 5 MiB.",
          ),
        );
      const data = new FormData();
      data.set(
        "image",
        new File([blob], `${kind}.jpg`, { type: "image/jpeg" }),
      );
      const response = await fetch(`/api/profile-media/${userId}/${kind}`, {
        method: "POST",
        body: data,
      });
      if (!response.ok)
        throw new Error(tr("Imagem inválida.", "Invalid image."));
      setPresent((current) => ({ ...current, [kind]: true }));
      setVersion((current) => current + 1);
      const oldPreview = previews[kind];
      if (oldPreview) URL.revokeObjectURL(oldPreview);
      previewUrls.current[kind] = null;
      setPreviews((current) => ({ ...current, [kind]: null }));
      setFiles((current) => ({ ...current, [kind]: null }));
      setActiveCrop(null);
      setStatus(tr("Imagem salva.", "Image saved."));
      window.dispatchEvent(new Event("openstudyhub:avatar-changed"));
      router.refresh();
    } catch (error) {
      setStatus(
        error instanceof Error && error.message.includes("5 MiB")
          ? error.message
          : tr(
              "Não foi possível salvar. Use PNG, JPEG ou WebP com até 10 MiB.",
              "Could not save. Use PNG, JPEG or WebP up to 10 MiB.",
            ),
      );
    } finally {
      setPending(null);
    }
  }

  async function remove(kind: Kind) {
    if (
      !window.confirm(
        tr(
          `Remover a imagem de ${kind === "avatar" ? "perfil" : "capa"}?`,
          `Remove ${kind === "avatar" ? "profile picture" : "cover image"}?`,
        ),
      )
    )
      return;
    setPending(kind);
    const response = await fetch(`/api/profile-media/${userId}/${kind}`, {
      method: "DELETE",
    });
    setStatus(
      response.ok
        ? tr("Imagem removida.", "Image removed.")
        : tr("Não foi possível remover.", "Could not remove image."),
    );
    if (response.ok) {
      setPresent((current) => ({ ...current, [kind]: false }));
      setVersion((current) => current + 1);
      window.dispatchEvent(new Event("openstudyhub:avatar-changed"));
      router.refresh();
    }
    setPending(null);
  }

  return (
    <div className="profile-media-settings">
      {(["avatar", "banner"] as const).map((kind) => {
        const isAvatar = kind === "avatar";
        const isPresent = present[kind];
        const source =
          previews[kind] ??
          (isPresent
            ? `/api/profile-media/${userId}/${kind}?v=${version}`
            : null);
        return (
          <section
            key={kind}
            className={`profile-media-form profile-media-${kind}`}
          >
            <label className="profile-media-picker">
              <span>
                {isAvatar
                  ? tr("Foto de perfil", "Profile picture")
                  : tr("Imagem de capa", "Cover image")}
              </span>
              <span
                className={`profile-media-preview ${isAvatar ? "is-avatar" : "is-banner"}`}
              >
                {source ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={source}
                    alt={tr(
                      `Prévia ${isAvatar ? "circular" : "horizontal"}`,
                      `${isAvatar ? "Circular" : "Horizontal"} preview`,
                    )}
                  />
                ) : (
                  <span aria-hidden="true">+</span>
                )}
                <span className="profile-media-overlay">
                  {files[kind]
                    ? tr("Prévia", "Preview")
                    : isPresent
                      ? tr("Trocar", "Replace")
                      : tr("Escolher", "Choose")}
                </span>
              </span>
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                aria-label={tr(
                  `Escolher ${isAvatar ? "foto de perfil" : "imagem de capa"}`,
                  `Choose ${isAvatar ? "profile picture" : "cover image"}`,
                )}
                onChange={(event) => {
                  const file = event.target.files?.[0] ?? null;
                  if (!file) return;
                  if (
                    !["image/png", "image/jpeg", "image/webp"].includes(
                      file.type,
                    ) ||
                    file.size > 10 * 1024 * 1024
                  ) {
                    setStatus(
                      tr(
                        "Escolha uma imagem PNG, JPEG ou WebP com até 10 MiB.",
                        "Choose a PNG, JPEG or WebP image up to 10 MiB.",
                      ),
                    );
                    event.target.value = "";
                    return;
                  }
                  const old = previews[kind];
                  if (old) URL.revokeObjectURL(old);
                  const preview = URL.createObjectURL(file);
                  previewUrls.current[kind] = preview;
                  setFiles((current) => ({ ...current, [kind]: file }));
                  setPreviews((current) => ({ ...current, [kind]: preview }));
                  setActiveCrop(kind);
                  setStatus("");
                  event.target.value = "";
                }}
              />
            </label>
            <div className="compact-actions profile-media-actions">
              {isPresent ? (
                <button
                  className="secondary-button"
                  type="button"
                  onClick={() => void remove(kind)}
                  disabled={pending !== null}
                >
                  <UiCopy pt="Remover" en="Remove" />
                </button>
              ) : null}
            </div>
          </section>
        );
      })}
      {activeCrop && previews[activeCrop] ? (
        <ProfileCropDialog
          key={previews[activeCrop]}
          kind={activeCrop}
          source={previews[activeCrop]}
          pending={pending === activeCrop}
          status={status}
          onCancel={() => cancelCrop(activeCrop)}
          onSave={(crop) => void upload(activeCrop, crop)}
        />
      ) : null}
      {status ? (
        <span role="status" aria-live="polite">
          {status}
        </span>
      ) : null}
    </div>
  );
}
