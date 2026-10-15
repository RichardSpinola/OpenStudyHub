"use client";
import {
  useEffect,
  useRef,
  useState,
  useImperativeHandle,
  type RefObject,
} from "react";
import { ProfileCropDialog } from "./profile-crop-dialog";
import { useUiText } from "./ui-language-provider";

/** One drag/zoom interaction for uploaded covers, icons and backgrounds. */
export function CroppedImageInput({
  name,
  label,
  currentSrc,
  aspectRatio = 16 / 9,
  maxMiB = 5,
  required = false,
  inputRef,
  hidePicker = false,
  onCropped,
}: {
  name: string;
  label: string;
  currentSrc?: string;
  aspectRatio?: number;
  maxMiB?: number;
  required?: boolean;
  inputRef?: RefObject<HTMLInputElement | null>;
  hidePicker?: boolean;
  onCropped?: (file: File) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  useImperativeHandle(inputRef, () => input.current!, []);
  const [original, setOriginal] = useState<File | null>(null);
  const accepted = useRef<File | null>(null);
  const urls = useRef<string[]>([]);
  const [source, setSource] = useState<string | null>(null),
    [preview, setPreview] = useState<string | null>(null);
  const [pending, setPending] = useState(false),
    [error, setError] = useState("");
  const tr = useUiText();
  useEffect(
    () => () => {
      urls.current.forEach((url) => URL.revokeObjectURL(url));
    },
    [],
  );
  function url(file: File) {
    const value = URL.createObjectURL(file);
    urls.current.push(value);
    return value;
  }
  function assign(file: File | null) {
    if (!input.current) return;
    const transfer = new DataTransfer();
    if (file) transfer.items.add(file);
    input.current.files = transfer.files;
  }
  async function save(crop: {
    x: number;
    y: number;
    width: number;
    height: number;
  }) {
    if (!original) return;
    setPending(true);
    setError("");
    let bitmap: ImageBitmap | null = null;
    try {
      bitmap = await createImageBitmap(original);
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.min(1600, Math.round(crop.width)));
      canvas.height = Math.max(1, Math.round(canvas.width / aspectRatio));
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Canvas unavailable");
      context.drawImage(
        bitmap,
        crop.x,
        crop.y,
        crop.width,
        crop.height,
        0,
        0,
        canvas.width,
        canvas.height,
      );
      const blob = await new Promise<Blob>((resolve, reject) =>
        canvas.toBlob(
          (value) =>
            value
              ? resolve(value)
              : reject(new Error("Image conversion failed")),
          "image/png",
        ),
      );
      if (blob.size > maxMiB * 1024 * 1024) throw new Error("Image too large");
      const file = new File([blob], "imagem-enquadrada.png", {
        type: "image/png",
      });
      assign(file);
      accepted.current = file;
      setPreview(url(file));
      setSource(null);
      onCropped?.(file);
    } catch {
      setError(
        tr(
          "Não foi possível preparar a imagem. Reduza o zoom ou escolha outra imagem.",
          "Could not prepare the image. Reduce zoom or choose another image.",
        ),
      );
    } finally {
      bitmap?.close();
      setPending(false);
    }
  }
  return (
    <>
      <div className={hidePicker ? "crop-input-hidden" : "cropped-image-input"}>
        <label>
          {label}
          <input
            ref={input}
            type="file"
            name={name}
            accept="image/png,image/jpeg,image/webp"
            required={required}
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (!file) return;
              if (
                !["image/png", "image/jpeg", "image/webp"].includes(
                  file.type,
                ) ||
                file.size > maxMiB * 1024 * 1024
              ) {
                setError(
                  tr(
                    `Escolha PNG, JPEG ou WebP de até ${maxMiB} MiB.`,
                    `Choose PNG, JPEG or WebP up to ${maxMiB} MiB.`,
                  ),
                );
                assign(accepted.current);
                return;
              }
              setOriginal(file);
              setError("");
              setSource(url(file));
            }}
          />
        </label>
        {!hidePicker && (preview || currentSrc) && (
          <div className="cropped-image-preview">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={preview ?? currentSrc}
              alt={tr("Prévia do enquadramento", "Crop preview")}
              style={{ aspectRatio }}
            />
            {original && (
              <button type="button" onClick={() => setSource(url(original!))}>
                {tr("Ajustar enquadramento", "Adjust framing")}
              </button>
            )}
          </div>
        )}
      </div>
      {error && <p role="alert">{error}</p>}
      {source && (
        <ProfileCropDialog
          kind="banner"
          saveLabel={tr("Usar enquadramento", "Use framing")}
          aspectRatio={aspectRatio}
          source={source}
          pending={pending}
          status={error}
          onCancel={() => {
            assign(accepted.current);
            setSource(null);
          }}
          onSave={(crop) => void save(crop)}
        />
      )}
    </>
  );
}
