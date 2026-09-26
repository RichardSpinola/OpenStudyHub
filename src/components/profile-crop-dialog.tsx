"use client";
import { UiCopy, useUiText } from "@/components/ui-language-provider";

import { useEffect, useRef, useState } from "react";

import {
  profileCropGeometry,
  type CropFrame,
  type CropOffset,
} from "@/lib/profile-crop";

type Kind = "avatar" | "banner";

export function ProfileCropDialog({
  kind,
  source,
  pending,
  status,
  onCancel,
  onSave,
}: {
  kind: Kind;
  source: string;
  pending: boolean;
  status: string;
  onCancel: () => void;
  onSave: (crop: {
    x: number;
    y: number;
    width: number;
    height: number;
  }) => void;
}) {
  const tr = useUiText();
  const dialog = useRef<HTMLDialogElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const drag = useRef<
    (CropOffset & { clientX: number; clientY: number }) | null
  >(null);
  const [image, setImage] = useState<CropFrame | null>(null);
  const [frame, setFrame] = useState<CropFrame>({ width: 0, height: 0 });
  const [offset, setOffset] = useState<CropOffset>({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);

  useEffect(() => {
    const modal = dialog.current;
    if (!modal) return;
    modal.showModal();
    return () => modal.close();
  }, []);

  useEffect(() => {
    const element = stage.current;
    if (!element) return;
    const observer = new ResizeObserver(() =>
      setFrame({ width: element.clientWidth, height: element.clientHeight }),
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const geometry =
    image && frame.width && frame.height
      ? profileCropGeometry(image, frame, zoom, offset)
      : null;

  function moveBy(x: number, y: number) {
    if (!image || !frame.width || !frame.height) return;
    setOffset(
      (current) =>
        profileCropGeometry(image, frame, zoom, {
          x: current.x + x,
          y: current.y + y,
        }).offset,
    );
  }

  return (
    <dialog
      ref={dialog}
      className="profile-crop-dialog"
      aria-labelledby="profile-crop-title"
      onCancel={(event) => {
        event.preventDefault();
        if (!pending) onCancel();
      }}
    >
      <div className="profile-crop-panel">
        <header>
          <button
            type="button"
            className="profile-crop-close"
            onClick={onCancel}
            disabled={pending}
            aria-label="Fechar recorte"
          >
            ×
          </button>
          <div>
            <span className="page-kicker">
              {kind === "avatar"
                ? tr("FOTO DE PERFIL", "PROFILE PHOTO")
                : tr("IMAGEM DE CAPA", "COVER IMAGE")}
            </span>
            <h2 id="profile-crop-title">
              <UiCopy
                pt="Arraste a imagem para ajustar"
                en="Drag the image to adjust it"
              />
            </h2>
          </div>
        </header>
        <div
          ref={stage}
          className={`profile-crop-stage is-${kind}`}
          role="img"
          tabIndex={0}
          aria-label={tr(
            "Área de recorte. Arraste ou use as setas do teclado para ajustar a imagem.",
            "Crop area. Drag or use the arrow keys to adjust the image.",
          )}
          onPointerDown={(event) => {
            if (!geometry) return;
            drag.current = {
              clientX: event.clientX,
              clientY: event.clientY,
              ...geometry.offset,
            };
            event.currentTarget.setPointerCapture(event.pointerId);
          }}
          onPointerMove={(event) => {
            if (!drag.current || !image) return;
            setOffset(
              profileCropGeometry(image, frame, zoom, {
                x: drag.current.x + event.clientX - drag.current.clientX,
                y: drag.current.y + event.clientY - drag.current.clientY,
              }).offset,
            );
          }}
          onPointerUp={() => {
            drag.current = null;
          }}
          onPointerCancel={() => {
            drag.current = null;
          }}
          onKeyDown={(event) => {
            const directions: Record<string, CropOffset> = {
              ArrowLeft: { x: -10, y: 0 },
              ArrowRight: { x: 10, y: 0 },
              ArrowUp: { x: 0, y: -10 },
              ArrowDown: { x: 0, y: 10 },
            };
            const direction = directions[event.key];
            if (!direction) return;
            event.preventDefault();
            moveBy(direction.x, direction.y);
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={source}
            alt=""
            draggable={false}
            style={geometry?.imageStyle ?? { visibility: "hidden" }}
            onLoad={(event) =>
              setImage({
                width: event.currentTarget.naturalWidth,
                height: event.currentTarget.naturalHeight,
              })
            }
          />
          <span className="profile-crop-mask" aria-hidden="true" />
        </div>
        <div className="profile-crop-zoom">
          <button
            type="button"
            aria-label="Diminuir zoom"
            onClick={() => setZoom((current) => Math.max(1, current - 0.1))}
            disabled={pending || zoom <= 1}
          >
            −
          </button>
          <label>
            Zoom
            <input
              type="range"
              min="1"
              max="3"
              step="0.05"
              value={zoom}
              onChange={(event) => setZoom(Number(event.target.value))}
              disabled={pending}
            />
          </label>
          <button
            type="button"
            aria-label="Aumentar zoom"
            onClick={() => setZoom((current) => Math.min(3, current + 0.1))}
            disabled={pending || zoom >= 3}
          >
            +
          </button>
        </div>
        {status ? (
          <p className="profile-crop-status" role="status">
            {status}
          </p>
        ) : null}
        <footer>
          <button type="button" onClick={onCancel} disabled={pending}>
            <UiCopy pt="Cancelar" en="Cancel" />
          </button>
          <button
            type="button"
            className="profile-crop-save"
            disabled={!geometry || pending}
            onClick={() => {
              if (geometry) onSave(geometry.source);
            }}
          >
            {pending ? "Salvando…" : "Aplicar e salvar"}
          </button>
        </footer>
      </div>
    </dialog>
  );
}
