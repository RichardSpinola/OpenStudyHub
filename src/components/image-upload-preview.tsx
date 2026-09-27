"use client";
import { UiCopy, useUiText } from "@/components/ui-language-provider";

import { useEffect, useRef, useState } from "react";

export function ImageUploadPreview({
  name,
  label,
  accept = "image/png,image/jpeg,image/webp",
  currentSrc,
  alt,
  maxMiB = 5,
}: {
  name: string;
  label: string;
  accept?: string;
  currentSrc?: string;
  alt: string;
  maxMiB?: number;
}) {
  const tr = useUiText();
  const [preview, setPreview] = useState<string | null>(null);
  const previewRef = useRef<string | null>(null);
  const [error, setError] = useState("");
  useEffect(
    () => () => {
      if (previewRef.current) URL.revokeObjectURL(previewRef.current);
    },
    [],
  );
  return (
    <label className="image-upload-preview">
      {label}
      <input
        type="file"
        name={name}
        accept={accept}
        required
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (!file) return;
          if (
            !file.type.startsWith("image/") ||
            file.size > maxMiB * 1024 * 1024
          ) {
            setError(
              tr(
                `Escolha uma imagem válida com até ${maxMiB} MiB.`,
                `Choose a valid image up to ${maxMiB} MiB.`,
              ),
            );
            setPreview(null);
            event.target.value = "";
            return;
          }
          setError("");
          if (previewRef.current) URL.revokeObjectURL(previewRef.current);
          const next = URL.createObjectURL(file);
          previewRef.current = next;
          setPreview(next);
        }}
      />
      {preview || currentSrc ? (
        <span className="image-upload-preview-frame">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={preview ?? currentSrc} alt={alt} />
          {preview ? (
            <span role="status">
              <UiCopy pt="Prévia da nova imagem" en="New image preview" />
            </span>
          ) : null}
        </span>
      ) : null}
      {error ? (
        <span role="alert" className="form-error">
          {error}
        </span>
      ) : null}
    </label>
  );
}
