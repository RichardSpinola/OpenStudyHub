"use client";
import { useTransition, useState } from "react";
import { useRouter } from "next/navigation";
import type { Shortcut } from "@/lib/shortcuts";
import { ShortcutGrid } from "./shortcut-grid";
import { ShortcutEditDialog } from "./shortcut-edit-dialog";
import {
  reorderShortcutsAction,
  togglePersonalShortcutAction,
} from "@/app/settings/actions";
import { useUiText } from "./ui-language-provider";
export function SettingsShortcuts({ items }: { items: Shortcut[] }) {
  const tr = useUiText(),
    router = useRouter();
  const [pending, start] = useTransition(),
    [status, setStatus] = useState(""),
    [editing, setEditing] = useState<Shortcut | null>(null);
  const active = items.filter((item) => item.enabled),
    hidden = items.filter((item) => !item.enabled);
  function reorder(id: number, targetId: number) {
    const ids = active.map((s) => s.id),
      from = ids.indexOf(id),
      to = ids.indexOf(targetId);
    if (from < 0 || to < 0 || from === to || pending) return;
    ids.splice(to, 0, ids.splice(from, 1)[0]);
    start(async () => {
      try {
        await reorderShortcutsAction(ids);
        setStatus(tr("Ordem salva.", "Order saved."));
        router.refresh();
      } catch {
        setStatus(
          tr(
            "Não foi possível mudar a ordem. Tente novamente.",
            "Could not change the order. Try again.",
          ),
        );
      }
    });
  }
  return (
    <div className="settings-shortcuts">
      <p className="settings-note">
        {tr(
          "Arraste para mudar a ordem ou use as setas. Os três pontos abrem nome, link, ícone e visibilidade.",
          "Drag to reorder or use the arrows. The three dots open name, link, icon and visibility.",
        )}
      </p>
      <ShortcutGrid
        shortcuts={active}
        canManage
        editing
        orderPending={pending}
        onDropShortcut={reorder}
        onMove={(id, direction) => {
          const index = active.findIndex((s) => s.id === id);
          const target = active[index + direction];
          if (target) reorder(id, target.id);
        }}
      />
      {hidden.length ? (
        <div className="settings-hidden-shortcuts">
          <h3>{tr("Ocultos na Home", "Hidden on Home")}</h3>
          {hidden.map((item) => (
            <div key={item.id}>
              <span>{item.name}</span>
              <button type="button" onClick={() => setEditing(item)}>
                {tr("Editar", "Edit")}
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={() =>
                  start(async () => {
                    try {
                      const form = new FormData();
                      form.set("id", String(item.id));
                      form.set("enabled", "true");
                      await togglePersonalShortcutAction(form);
                      router.refresh();
                    } catch {
                      setStatus(
                        tr(
                          "Não foi possível mostrar este atalho.",
                          "Could not show this shortcut.",
                        ),
                      );
                    }
                  })
                }
              >
                {tr("Mostrar na Home", "Show on Home")}
              </button>
            </div>
          ))}
        </div>
      ) : null}
      <p role="status">{pending ? tr("Salvando…", "Saving…") : status}</p>
      {editing ? (
        <ShortcutEditDialog shortcut={editing} close={() => setEditing(null)} />
      ) : null}
    </div>
  );
}
