"use client";
import { useEffect, useRef, useState } from "react";
import { NotePanel } from "@/components/note-panel";
import { ProfileCropDialog } from "@/components/profile-crop-dialog";
import { useUiText } from "@/components/ui-language-provider";
import { noteImageMaxBytes } from "@/lib/note-image-url";
export function NoteImagePicker({
  onInsert,
}: {
  onInsert: (file: File, caption: string) => Promise<void>;
}) {
  const tr = useUiText(),
    dialog = useRef<HTMLDialogElement>(null),
    input = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null),
    [source, setSource] = useState(""),
    [caption, setCaption] = useState(""),
    [error, setError] = useState(""),
    [pending, setPending] = useState(false),
    [cropping, setCropping] = useState(false),
    [ratio, setRatio] = useState("original"),
    [originalRatio, setOriginalRatio] = useState(1);
  const objectUrl = useRef("");
  const selection = useRef(0);
  function changeFile(value: File | null) {
    if (objectUrl.current) URL.revokeObjectURL(objectUrl.current);
    objectUrl.current = value ? URL.createObjectURL(value) : "";
    setFile(value);
    setSource(objectUrl.current);
  }
  useEffect(
    () => () => {
      if (objectUrl.current) URL.revokeObjectURL(objectUrl.current);
    },
    [],
  );
  async function select(selected: File | undefined) {
    if (!selected) return;
    const attempt = ++selection.current;
    changeFile(null);
    setError("");
    if (
      selected.size > noteImageMaxBytes ||
      !["image/png", "image/jpeg", "image/webp"].includes(selected.type)
    ) {
      setError(
        tr(
          "Escolha PNG, JPG ou WebP de até 5 MB.",
          "Choose PNG, JPG or WebP up to 5 MB.",
        ),
      );
      if (input.current) input.current.value = "";
      return;
    }
    try {
      const bitmap = await createImageBitmap(selected);
      if (bitmap.width * bitmap.height > 20_000_000) {
        bitmap.close();
        throw new Error("size");
      }
      if (attempt !== selection.current) {
        bitmap.close();
        return;
      }
      setOriginalRatio(bitmap.width / bitmap.height);
      bitmap.close();
      changeFile(selected);
    } catch {
      setError(
        tr(
          "Não foi possível abrir essa imagem. Use outra imagem, com até 20 megapixels.",
          "Could not open this image. Choose another image up to 20 megapixels.",
        ),
      );
    }
  }
  return (
    <NotePanel
      dialogRef={dialog}
      busy={pending}
      label={tr("Inserir imagem", "Insert image")}
      triggerLabel={tr("▧ Imagem", "▧ Image")}
    >
      <form
        className="note-create-form"
        action={async () => {
          if (!file) {
            setError(
              tr("Escolha uma imagem primeiro.", "Choose an image first."),
            );
            return;
          }
          setPending(true);
          setError("");
          try {
            await onInsert(file, caption);
            dialog.current?.close();
            changeFile(null);
            setCaption("");
            if (input.current) input.current.value = "";
          } catch (e) {
            setError(
              e instanceof Error
                ? e.message
                : tr(
                    "Não foi possível enviar. Tente novamente.",
                    "Could not upload. Try again.",
                  ),
            );
          } finally {
            setPending(false);
          }
        }}
      >
        <label>
          {tr("Imagem do dispositivo", "Image from your device")}
          <input
            ref={input}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            disabled={pending}
            onChange={(e) => void select(e.target.files?.[0])}
          />
        </label>
        <p className="note-muted">
          {tr(
            "PNG, JPG ou WebP · até 5 MB. Você também pode colar ou arrastar uma imagem para o texto.",
            "PNG, JPG or WebP · up to 5 MB. You can also paste or drag an image into the text.",
          )}
        </p>
        {source ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              className="note-image-preview"
              src={source}
              alt={tr("Prévia da imagem", "Image preview")}
            />
            <div className="note-image-crop-tools">
              <label>
                {tr("Formato do recorte", "Crop shape")}
                <select
                  value={ratio}
                  onChange={(e) => setRatio(e.target.value)}
                  disabled={pending}
                >
                  <option value="original">
                    {tr("Proporção original", "Original ratio")}
                  </option>
                  <option value="1">{tr("Quadrado", "Square")}</option>
                  <option value="1.7777777778">
                    {tr("Paisagem · 16:9", "Landscape · 16:9")}
                  </option>
                </select>
              </label>
              <button
                type="button"
                disabled={pending}
                onClick={() => setCropping(true)}
              >
                {tr("Ajustar enquadramento", "Adjust framing")}
              </button>
            </div>
            <label>
              {tr("Legenda · opcional", "Caption · optional")}
              <input
                value={caption}
                maxLength={500}
                disabled={pending}
                onChange={(e) => setCaption(e.target.value)}
              />
            </label>
          </>
        ) : null}
        {error ? (
          <p role="alert" className="form-error">
            {error}
          </p>
        ) : null}
        <div className="note-dialog-actions">
          <button
            type="button"
            disabled={pending}
            onClick={() => dialog.current?.close()}
          >
            {tr("Cancelar", "Cancel")}
          </button>
          <button disabled={pending || !file}>
            {pending
              ? tr("Enviando imagem…", "Uploading image…")
              : tr("Inserir na página", "Insert into page")}
          </button>
        </div>
      </form>
      {cropping && source ? (
        <ProfileCropDialog
          kind="banner"
          aspectRatio={ratio === "original" ? originalRatio : Number(ratio)}
          source={source}
          pending={pending}
          status={error}
          saveLabel={tr("Usar enquadramento", "Use framing")}
          onCancel={() => setCropping(false)}
          onSave={async (crop) => {
            if (!file) return;
            setPending(true);
            setError("");
            try {
              const bitmap = await createImageBitmap(file),
                canvas = document.createElement("canvas");
              const scale = Math.min(
                1,
                2560 / Math.max(crop.width, crop.height),
              );
              canvas.width = Math.max(1, Math.round(crop.width * scale));
              canvas.height = Math.max(1, Math.round(crop.height * scale));
              const context = canvas.getContext("2d");
              if (!context) {
                bitmap.close();
                throw new Error("canvas");
              }
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
              bitmap.close();
              const blob = await new Promise<Blob | null>((resolve) =>
                canvas.toBlob(resolve, "image/webp", 0.9),
              );
              if (!blob) throw new Error("crop");
              changeFile(
                new File([blob], "imagem.webp", { type: "image/webp" }),
              );
              setOriginalRatio(canvas.width / canvas.height);
              setRatio("original");
              setCropping(false);
            } catch {
              setError(
                tr(
                  "Não foi possível recortar. Tente novamente.",
                  "Could not crop. Try again.",
                ),
              );
            } finally {
              setPending(false);
            }
          }}
        />
      ) : null}
    </NotePanel>
  );
}
