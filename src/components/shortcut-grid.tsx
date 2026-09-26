"use client";

import { useState } from "react";
import { useUiTranslations } from "@/components/ui-language-provider";
import type { Shortcut } from "@/lib/shortcuts";
import {
  IconBrandGoogleDrive,
  IconBrandGmail,
  IconBrandGithub,
  IconChalkboardTeacher,
} from "@tabler/icons-react";

import { QuickAddShortcut } from "./quick-add-shortcut";

function fallbackIcon(name: string): string {
  const words = name.trim().split(/\s+/u).filter(Boolean);
  if (words.length >= 2) {
    return `${words[0][0] ?? ""}${words[1][0] ?? ""}`.toUpperCase();
  }
  return (words[0] ?? "WEB").slice(0, 3).toUpperCase();
}

function knownShortcutIcon(url: string) {
  try {
    const host = new URL(url).hostname.toLowerCase();
    if (host === "drive.google.com") return IconBrandGoogleDrive;
    if (host === "classroom.google.com") return IconChalkboardTeacher;
    if (host === "mail.google.com" || host === "gmail.com")
      return IconBrandGmail;
    if (host === "github.com" || host === "www.github.com")
      return IconBrandGithub;
  } catch {
    /* Invalid URLs are rejected when shortcuts are saved. */
  }
  return null;
}

export function ShortcutGrid({
  shortcuts,
  canManage,
  editing = false,
  orderPending = false,
  onMove,
}: {
  shortcuts: Shortcut[];
  canManage: boolean;
  editing?: boolean;
  orderPending?: boolean;
  onMove?: (id: number, direction: -1 | 1) => void;
}) {
  const { shortcuts: labels } = useUiTranslations();
  const [failedIconIds, setFailedIconIds] = useState<Set<number>>(new Set());
  const items = shortcuts;

  return (
    <>
      <ul
        className={`shortcut-grid ${items.length === 0 ? "is-empty" : ""}`}
        aria-label={labels.listLabel}
      >
        {items.map((shortcut, index) => {
          const KnownIcon = knownShortcutIcon(shortcut.url);
          return (
            <li key={shortcut.id} data-shortcut-id={shortcut.id}>
              <a
                className="shortcut-link"
                href={shortcut.url}
                target="_blank"
                rel="noreferrer"
              >
                <span className="shortcut-visual" aria-hidden="true">
                  {KnownIcon ? (
                    <KnownIcon size={28} stroke={1.6} />
                  ) : shortcut.iconStorageName &&
                    !failedIconIds.has(shortcut.id) ? (
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
              {editing ? (
                <div className="shortcut-reorder-actions">
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
    </>
  );
}
