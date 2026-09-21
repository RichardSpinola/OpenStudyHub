"use client";

import { useState, useTransition } from "react";

import { reorderShortcutsAction } from "@/app/settings/actions";
import { useUiTranslations } from "@/components/ui-language-provider";
import type { Shortcut } from "@/lib/shortcuts";

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
}: {
  shortcuts: Shortcut[];
  canManage: boolean;
}) {
  const { shortcuts: labels } = useUiTranslations();
  const [orderedIds, setOrderedIds] = useState<number[] | null>(null);
  const [draggedId, setDraggedId] = useState<number | null>(null);
  const [dropTargetId, setDropTargetId] = useState<number | null>(null);
  const [reorderError, setReorderError] = useState(false);
  const [failedIconIds, setFailedIconIds] = useState<Set<number>>(new Set());
  const [, startTransition] = useTransition();
  const items = orderedIds
    ? [
        ...orderedIds
          .map((id) => shortcuts.find((shortcut) => shortcut.id === id))
          .filter((shortcut): shortcut is Shortcut => shortcut !== undefined),
        ...shortcuts.filter(({ id }) => !orderedIds.includes(id)),
      ]
    : shortcuts;

  function handleDrop(targetId: number) {
    if (!canManage) return;
    if (draggedId === null || draggedId === targetId) {
      setDropTargetId(null);
      return;
    }

    const reorderedItems = [...items];
    const sourceIndex = reorderedItems.findIndex(({ id }) => id === draggedId);
    const targetIndex = reorderedItems.findIndex(({ id }) => id === targetId);

    if (sourceIndex === -1 || targetIndex === -1) {
      return;
    }

    const [movedItem] = reorderedItems.splice(sourceIndex, 1);
    reorderedItems.splice(targetIndex, 0, movedItem);
    const reorderedIds = reorderedItems.map(({ id }) => id);
    setOrderedIds(reorderedIds);
    setDraggedId(null);
    setDropTargetId(null);
    setReorderError(false);

    startTransition(async () => {
      try {
        await reorderShortcutsAction(reorderedIds);
      } catch {
        setOrderedIds(null);
        setReorderError(true);
      }
    });
  }

  return (
    <>
      <p className="sr-only" id="shortcut-drag-help">
        {labels.dragHelp}
      </p>
      <ul
        className={`shortcut-grid ${items.length === 0 ? "is-empty" : ""}`}
        aria-label={labels.listLabel}
      >
        {items.map((shortcut) => (
          <li
            key={shortcut.id}
            className={`${draggedId === shortcut.id ? "is-dragging" : ""} ${dropTargetId === shortcut.id ? "is-drop-target" : ""}`}
            draggable={canManage}
            onDragStart={(event) => {
              if (!canManage) return;
              event.dataTransfer.effectAllowed = "move";
              event.dataTransfer.setData("text/plain", String(shortcut.id));
              setDraggedId(shortcut.id);
            }}
            onDragOver={(event) => {
              event.preventDefault();
              event.dataTransfer.dropEffect = "move";
              setDropTargetId(shortcut.id);
            }}
            onDragLeave={() => setDropTargetId(null)}
            onDrop={(event) => {
              event.preventDefault();
              handleDrop(shortcut.id);
            }}
            onDragEnd={() => {
              setDraggedId(null);
              setDropTargetId(null);
            }}
          >
            <a
              className="shortcut-link"
              href={shortcut.url}
              target="_blank"
              rel="noreferrer"
              draggable={false}
              aria-describedby="shortcut-drag-help"
            >
              <span className="shortcut-visual" aria-hidden="true">
                {shortcut.iconStorageName && !failedIconIds.has(shortcut.id) ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={`/api/shortcut-icon/user/${shortcut.id}`}
                    alt=""
                    onError={() =>
                      setFailedIconIds((current) => {
                        const next = new Set(current);
                        next.add(shortcut.id);
                        return next;
                      })
                    }
                  />
                ) : (
                  <span>{shortcut.icon || fallbackIcon(shortcut.name)}</span>
                )}
              </span>
              <span className="shortcut-name">{shortcut.name}</span>
            </a>
          </li>
        ))}
        {canManage ? (
          <li>
            <QuickAddShortcut />
          </li>
        ) : null}
      </ul>
      {reorderError ? (
        <p className="shortcut-feedback" role="alert">
          {labels.orderRestored}
        </p>
      ) : null}
    </>
  );
}
