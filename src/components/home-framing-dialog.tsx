"use client";
import { useEffect, useRef, useState } from "react";
import {
  profileCropGeometry,
  type CropFrame,
  type CropOffset,
} from "@/lib/profile-crop";
import type { HomePresentation } from "@/lib/home-presentation";
import { useUiText } from "./ui-language-provider";
export function HomeFramingDialog({
  source,
  initial,
  onCancel,
  onApply,
}: {
  source: string;
  initial: HomePresentation;
  onCancel: () => void;
  onApply: (value: HomePresentation) => void;
}) {
  const tr = useUiText();
  const dialog = useRef<HTMLDialogElement>(null),
    stage = useRef<HTMLDivElement>(null);
  const drag = useRef<
    (CropOffset & { clientX: number; clientY: number }) | null
  >(null);
  const [image, setImage] = useState<CropFrame | null>(null),
    [frame, setFrame] = useState<CropFrame>({ width: 0, height: 0 }),
    [offset, setOffset] = useState<CropOffset | null>(null),
    [zoom, setZoom] = useState(initial.wallpaperZoom);
  useEffect(() => {
    const d = dialog.current;
    d?.showModal();
    return () => d?.close();
  }, []);
  useEffect(() => {
    const el = stage.current;
    if (!el) return;
    const main = document.querySelector(".app-content");
    const update = () => {
      if (main)
        el.style.aspectRatio = `${main.clientWidth} / ${main.clientHeight || 1}`;
      setFrame({ width: el.clientWidth, height: el.clientHeight });
    };
    const observer = new ResizeObserver(update);
    observer.observe(el);
    update();
    return () => observer.disconnect();
  }, []);
  let geometry: ReturnType<typeof profileCropGeometry> | null = null;
  if (image && frame.width && frame.height) {
    const base = profileCropGeometry(image, frame, zoom, { x: 0, y: 0 });
    const initialOffset = {
      x:
        ((50 - initial.wallpaperX) / 100) *
        (base.imageStyle.width - frame.width),
      y:
        ((50 - initial.wallpaperY) / 100) *
        (base.imageStyle.height - frame.height),
    };
    geometry = profileCropGeometry(image, frame, zoom, offset ?? initialOffset);
  }
  function move(x: number, y: number) {
    if (!geometry || !image) return;
    setOffset(
      profileCropGeometry(image, frame, zoom, {
        x: geometry.offset.x + x,
        y: geometry.offset.y + y,
      }).offset,
    );
  }
  return (
    <dialog
      ref={dialog}
      className="profile-crop-dialog home-framing-dialog"
      aria-labelledby="home-frame-title"
      onClose={() => {
        if (!dialog.current?.open) onCancel();
      }}
      onCancel={(e) => {
        e.preventDefault();
        onCancel();
      }}
    >
      <div className="profile-crop-panel">
        <header>
          <div>
            <span className="page-kicker">HOME</span>
            <h2 id="home-frame-title">
              {tr(
                "Arraste a imagem para enquadrar",
                "Drag the image to frame it",
              )}
            </h2>
          </div>
          <button
            type="button"
            onClick={onCancel}
            aria-label={tr("Fechar enquadramento", "Close framing")}
          >
            ×
          </button>
        </header>
        <div
          ref={stage}
          className="profile-crop-stage home-framing-stage"
          role="img"
          tabIndex={0}
          aria-label={tr(
            "Enquadramento da Home. Arraste ou use as setas para mover a imagem.",
            "Home framing. Drag or use arrow keys to move the image.",
          )}
          onPointerDown={(e) => {
            if (!geometry) return;
            drag.current = {
              ...geometry.offset,
              clientX: e.clientX,
              clientY: e.clientY,
            };
            e.currentTarget.setPointerCapture(e.pointerId);
          }}
          onPointerMove={(e) => {
            if (!drag.current || !image) return;
            setOffset(
              profileCropGeometry(image, frame, zoom, {
                x: drag.current.x + e.clientX - drag.current.clientX,
                y: drag.current.y + e.clientY - drag.current.clientY,
              }).offset,
            );
          }}
          onPointerUp={() => {
            drag.current = null;
          }}
          onPointerCancel={() => {
            drag.current = null;
          }}
          onKeyDown={(e) => {
            const d: Record<string, CropOffset> = {
              ArrowLeft: { x: -10, y: 0 },
              ArrowRight: { x: 10, y: 0 },
              ArrowUp: { x: 0, y: -10 },
              ArrowDown: { x: 0, y: 10 },
            };
            if (d[e.key]) {
              e.preventDefault();
              move(d[e.key].x, d[e.key].y);
            }
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={source}
            alt=""
            draggable={false}
            style={geometry?.imageStyle ?? { visibility: "hidden" }}
            onLoad={(e) =>
              setImage({
                width: e.currentTarget.naturalWidth,
                height: e.currentTarget.naturalHeight,
              })
            }
          />
          <span className="home-framing-guides" aria-hidden="true" />
        </div>
        <div className="profile-crop-zoom">
          <button
            type="button"
            onClick={() => setZoom((z) => Math.max(1, z - 0.1))}
            disabled={zoom <= 1}
            aria-label={tr("Diminuir zoom", "Zoom out")}
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
              onChange={(e) => setZoom(Number(e.target.value))}
            />
          </label>
          <button
            type="button"
            onClick={() => setZoom((z) => Math.min(3, z + 0.1))}
            disabled={zoom >= 3}
            aria-label={tr("Aumentar zoom", "Zoom in")}
          >
            +
          </button>
        </div>
        <footer>
          <button type="button" onClick={onCancel}>
            {tr("Cancelar", "Cancel")}
          </button>
          <button
            type="button"
            disabled={!geometry}
            onClick={() => {
              if (!geometry) return;
              const dx = geometry.imageStyle.width - frame.width,
                dy = geometry.imageStyle.height - frame.height;
              onApply({
                ...initial,
                wallpaperFit: "cover",
                wallpaperZoom: zoom,
                wallpaperX: dx
                  ? Math.round(50 - (geometry.offset.x / dx) * 100)
                  : 50,
                wallpaperY: dy
                  ? Math.round(50 - (geometry.offset.y / dy) * 100)
                  : 50,
              });
            }}
          >
            {tr("Aplicar enquadramento", "Apply framing")}
          </button>
        </footer>
      </div>
    </dialog>
  );
}
