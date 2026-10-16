"use client";

import { useRef, useState } from "react";
import {
  useUiText,
  useUiTranslations,
} from "@/components/ui-language-provider";
import type { Shortcut } from "@/lib/shortcuts";
import { shortcutPresetFor } from "@/lib/shortcut-icon-catalog";
import { ShortcutPresetIcon } from "./shortcut-icon";

import { ShortcutEditDialog } from "./shortcut-edit-dialog";
import { QuickAddShortcut } from "./quick-add-shortcut";

function fallbackIcon(name: string): string {
  const words = name.trim().split(/\s+/u).filter(Boolean);
  if (words.length >= 2) {
    return `${words[0][0] ?? ""}${words[1][0] ?? ""}`.toUpperCase();
  }
  return (words[0] ?? "WEB").slice(0, 3).toUpperCase();
}

export function ShortcutGrid({
  shortcuts,
  canManage,
  editing = false,
  orderPending = false,
  onMove,
  onDropShortcut,
}: {
  shortcuts: Shortcut[];
  canManage: boolean;
  editing?: boolean;
  orderPending?: boolean;
  onMove?: (id: number, direction: -1 | 1) => void;
  onDropShortcut?: (id: number, targetId: number) => void;
}) {
  const { shortcuts: labels } = useUiTranslations();
  const tr = useUiText();
  const [failedIconIds, setFailedIconIds] = useState<Set<string>>(new Set());
  const items = shortcuts;
  const [editingShortcut, setEditingShortcut] = useState<Shortcut | null>(null);
  const dragId = useRef<number | null>(null);
  const touch = useRef<{ id: number; x: number; y: number } | null>(null);
  const editTrigger = useRef<HTMLButtonElement | null>(null);

  return (
    <>
      <ul
        className={`shortcut-grid ${items.length === 0 ? "is-empty" : ""}`}
        aria-label={labels.listLabel}
      >
        {items.map((shortcut, index) => {
          const preset = shortcutPresetFor(shortcut.url, shortcut.icon);
          return (
            <li
              key={shortcut.id}
              data-shortcut-id={shortcut.id}
              draggable={!orderPending}
              onDragStart={(event) => {
                if (orderPending) {
                  event.preventDefault();
                  return;
                }
                dragId.current = shortcut.id;
                event.dataTransfer.effectAllowed = "move";
                event.dataTransfer.setData("text/plain", String(shortcut.id));
              }}
              onDragEnd={() => {
                dragId.current = null;
              }}
              onDragOver={(event) => {
                if (dragId.current !== null && !orderPending)
                  event.preventDefault();
              }}
              onDrop={(event) => {
                event.preventDefault();
                if (dragId.current !== null && !orderPending)
                  onDropShortcut?.(dragId.current, shortcut.id);
                dragId.current = null;
              }}
            >
              <a
                className="shortcut-link"
                href={shortcut.url}
                target="_blank"
                rel="noreferrer"
                draggable={!orderPending}
              >
                <span className="shortcut-visual" aria-hidden="true">
                  {preset ? (
                    <ShortcutPresetIcon preset={preset} />
                  ) : shortcut.icon !== "@text" &&
                    shortcut.iconStorageName &&
                    !failedIconIds.has(
                      `${shortcut.id}:${shortcut.iconStorageName}`,
                    ) ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      key={shortcut.iconStorageName}
                      src={`/api/shortcut-icon/user/${shortcut.id}?v=${shortcut.iconStorageName}`}
                      alt=""
                      onError={() =>
                        setFailedIconIds((current) => {
                          const next = new Set(current);
                          next.add(
                            `${shortcut.id}:${shortcut.iconStorageName}`,
                          );
                          return next;
                        })
                      }
                    />
                  ) : (
                    <span>
                      {shortcut.icon && !shortcut.icon.startsWith("@")
                        ? shortcut.icon
                        : fallbackIcon(shortcut.name)}
                    </span>
                  )}
                </span>
                <span className="shortcut-name">{shortcut.name}</span>
              </a>
              <button
                type="button"
                className="home-shortcut-options"
                aria-label={tr(
                  `Opções de ${shortcut.name}`,
                  `Options for ${shortcut.name}`,
                )}
                onClick={(event) => {
                  editTrigger.current = event.currentTarget;
                  setEditingShortcut(shortcut);
                }}
              >
                ⋯
              </button>
              {editing ? (
                <div className="shortcut-reorder-actions">
                  <button
                    type="button"
                    className="shortcut-drag-handle"
                    aria-label={tr(
                      `Arrastar ${shortcut.name}`,
                      `Drag ${shortcut.name}`,
                    )}
                    disabled={orderPending}
                    onPointerDown={(event) => {
                      touch.current = {
                        id: shortcut.id,
                        x: event.clientX,
                        y: event.clientY,
                      };
                      event.currentTarget.setPointerCapture(event.pointerId);
                    }}
                    onPointerCancel={() => {
                      touch.current = null;
                    }}
                    onPointerUp={(event) => {
                      const origin = touch.current;
                      touch.current = null;
                      if (
                        !origin ||
                        Math.hypot(
                          event.clientX - origin.x,
                          event.clientY - origin.y,
                        ) < 8
                      )
                        return;
                      const item = document
                        .elementFromPoint(event.clientX, event.clientY)
                        ?.closest<HTMLElement>("[data-shortcut-id]");
                      if (item)
                        onDropShortcut?.(
                          origin.id,
                          Number(item.dataset.shortcutId),
                        );
                    }}
                  >
                    ⠿
                  </button>
                  <button
                    type="button"
                    aria-label={`Mover ${shortcut.name} para a esquerda`}
                    disabled={index === 0 || orderPending}
                    onClick={() => onMove?.(shortcut.id, -1)}
                  >
                    ←
                  </button>
                  <button
                    type="button"
                    aria-label={`Mover ${shortcut.name} para a direita`}
                    disabled={index === items.length - 1 || orderPending}
                    onClick={() => onMove?.(shortcut.id, 1)}
                  >
                    →
                  </button>
                </div>
              ) : null}
            </li>
          );
        })}
        {canManage ? (
          <li style={{ order: items.length }}>
            <QuickAddShortcut />
          </li>
        ) : null}
      </ul>
      {editingShortcut ? (
        <ShortcutEditDialog
          shortcut={editingShortcut}
          close={() => {
            setEditingShortcut(null);
            editTrigger.current?.focus();
          }}
        />
      ) : null}
    </>
  );
}
