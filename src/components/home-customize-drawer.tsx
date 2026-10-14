"use client";
import { UiCopy, useUiText } from "@/components/ui-language-provider";

import Link from "next/link";
import { HomePresentationControls } from "./home-presentation-controls";
import type { HomePresentation } from "@/lib/home-presentation";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { IconPencil } from "@tabler/icons-react";

import {
  updateHomePreferencesAction,
  updateHomeControlAction,
  togglePersonalShortcutAction,
} from "@/app/settings/actions";
import { HomeBackgroundSettings } from "@/components/home-background-settings";
import type { WallpaperCatalog } from "@/lib/home-wallpapers";
import type { Shortcut } from "@/lib/shortcuts";
import type { Appearance } from "@/lib/appearance";

export function HomeCustomizeDrawer({
  presentation,
  presentationAvailable,
  catalog,
  wallpaperLimitMiB,
  shortcuts,
  searchEngine,
  searchPending,
  searchError,
  onSearchEngineChange,
  onEditShortcuts,
  theme,
  clockEnabled,
  clockPosition,
  todayWidgetEnabled,
}: {
  presentation: HomePresentation;
  presentationAvailable: boolean;
  catalog: WallpaperCatalog;
  wallpaperLimitMiB: 5 | 10;
  shortcuts: Shortcut[];
  searchEngine: Appearance["searchEngine"];
  searchPending: boolean;
  searchError: boolean;
  onSearchEngineChange: (engine: Appearance["searchEngine"]) => void;
  onEditShortcuts: () => void;
  theme: "dark" | "light";
  clockEnabled: boolean;
  clockPosition: "top-left" | "top-right" | "bottom-left" | "bottom-right";
  todayWidgetEnabled: boolean;
}) {
  const tr = useUiText();
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const pathname = usePathname();
  const moved = useRef(false);
  const drag = useRef<{
    pointer: number;
    x: number;
    y: number;
    left: number;
    top: number;
  } | null>(null);
  const placement = useRef<{ x: number | null; y: number | null }>({
    x: presentation.controlX,
    y: presentation.controlY,
  });
  const [positionError, setPositionError] = useState(false);
  function bounds() {
    const main = document.querySelector(".app-content"),
      button = trigger.current;
    if (!main || !button) return null;
    const r = main.getBoundingClientRect();
    return {
      left: r.left + 16,
      top: r.top + 16,
      width: Math.max(0, r.width - button.offsetWidth - 32),
      height: Math.max(0, r.height - button.offsetHeight - 32),
    };
  }
  function position(x: number, y: number) {
    const r = bounds();
    if (!r || !trigger.current) return;
    trigger.current.style.left = `${r.left + (r.width * x) / 100}px`;
    trigger.current.style.top = `${r.top + (r.height * y) / 100}px`;
  }
  async function persistPosition() {
    const form = new FormData();
    form.set("controlX", String(placement.current.x));
    form.set("controlY", String(placement.current.y));
    try {
      await updateHomeControlAction(form);
      setPositionError(false);
    } catch {
      setPositionError(true);
    }
  }
  const [selectedClockPosition, setSelectedClockPosition] =
    useState(clockPosition);
  const [clockShown, setClockShown] = useState(clockEnabled);
  const [todayShown, setTodayShown] = useState(todayWidgetEnabled);

  useEffect(() => {
    dialog.current?.close();
  }, [pathname]);

  useEffect(() => {
    const modal = dialog.current;
    if (!modal) return;
    const restore = () => trigger.current?.focus();
    modal.addEventListener("close", restore);
    return () => modal.removeEventListener("close", restore);
  }, []);

  useEffect(() => {
    const main = document.querySelector(".app-content");
    if (!main) return;
    placement.current = { x: presentation.controlX, y: presentation.controlY };
    const update = () =>
      position(
        placement.current.x ??
          (clockEnabled && clockPosition === "bottom-right" ? 0 : 100),
        placement.current.y ?? 100,
      );
    const observer = new ResizeObserver(update);
    observer.observe(main);
    window.addEventListener("resize", update);
    update();
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", update);
    };
    // position reads the current content rectangle and does not capture changing state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    presentation.controlX,
    presentation.controlY,
    clockEnabled,
    clockPosition,
  ]);

  function closeOutside(event: React.MouseEvent<HTMLDialogElement>) {
    if (event.target === dialog.current) dialog.current?.close();
  }

  return (
    <>
      {presentation.controlEnabled ? (
        <button
          ref={trigger}
          className="home-customize-trigger"
          data-clock-position={clockEnabled ? clockPosition : "none"}
          type="button"
          aria-label={tr("Personalizar Home", "Customize Home")}
          title={tr(
            "Clique para personalizar; arraste para mover. Alt + setas também move.",
            "Click to customize; drag to move. Alt + arrows also moves.",
          )}
          onPointerDown={(e) => {
            if (e.button !== 0) return;
            const r = e.currentTarget.getBoundingClientRect();
            drag.current = {
              pointer: e.pointerId,
              x: e.clientX,
              y: e.clientY,
              left: r.left,
              top: r.top,
            };
            moved.current = false;
            e.currentTarget.setPointerCapture(e.pointerId);
          }}
          onPointerMove={(e) => {
            const d = drag.current,
              r = bounds();
            if (!d || !r || d.pointer !== e.pointerId) return;
            const dx = e.clientX - d.x,
              dy = e.clientY - d.y;
            if (Math.hypot(dx, dy) < 5 && !moved.current) return;
            moved.current = true;
            const x = r.width
                ? Math.max(
                    0,
                    Math.min(100, ((d.left + dx - r.left) / r.width) * 100),
                  )
                : 0,
              y = r.height
                ? Math.max(
                    0,
                    Math.min(100, ((d.top + dy - r.top) / r.height) * 100),
                  )
                : 0;
            placement.current = { x, y };
            position(x, y);
          }}
          onPointerUp={(e) => {
            if (!drag.current || drag.current.pointer !== e.pointerId) return;
            drag.current = null;
            e.currentTarget.releasePointerCapture(e.pointerId);
            if (moved.current) void persistPosition();
          }}
          onPointerCancel={() => {
            drag.current = null;
            moved.current = false;
          }}
          onKeyDown={(e) => {
            if (
              !e.altKey ||
              !["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(
                e.key,
              )
            )
              return;
            e.preventDefault();
            const x = Math.max(
                0,
                Math.min(
                  100,
                  (placement.current.x ??
                    (clockEnabled && clockPosition === "bottom-right"
                      ? 0
                      : 100)) +
                    (e.key === "ArrowLeft"
                      ? -5
                      : e.key === "ArrowRight"
                        ? 5
                        : 0),
                ),
              ),
              y = Math.max(
                0,
                Math.min(
                  100,
                  (placement.current.y ?? 100) +
                    (e.key === "ArrowUp" ? -5 : e.key === "ArrowDown" ? 5 : 0),
                ),
              );
            placement.current = { x, y };
            position(x, y);
            void persistPosition();
          }}
          onClick={() => {
            if (moved.current) {
              moved.current = false;
              return;
            }
            setSelectedClockPosition(clockPosition);
            setClockShown(clockEnabled);
            setTodayShown(todayWidgetEnabled);
            dialog.current?.showModal();
          }}
        >
          <IconPencil size={20} aria-hidden="true" />
        </button>
      ) : null}
      {positionError ? (
        <small className="home-control-error" role="status">
          {tr(
            "Não foi possível salvar a posição. Tente mover novamente.",
            "Could not save the position. Try moving again.",
          )}
        </small>
      ) : null}
      <dialog
        ref={dialog}
        className="home-customize-dialog"
        aria-labelledby="home-customize-title"
        onClick={closeOutside}
      >
        <div className="home-customize-panel">
          <header>
            <div>
              <span className="page-kicker">HOME</span>
              <h2 id="home-customize-title">
                <UiCopy pt="Personalizar" en="Customize" />
              </h2>
            </div>
            <button
              type="button"
              className="home-customize-close"
              onClick={() => dialog.current?.close()}
              aria-label={tr("Fechar personalização", "Close customization")}
            >
              ×
            </button>
          </header>
          <div className="home-customize-content">
            <section aria-labelledby="home-wallpaper-title">
              <h3 id="home-wallpaper-title">
                <UiCopy pt="Fundo da Home" en="Home background" />
              </h3>
              <HomeBackgroundSettings
                configured={false}
                catalog={catalog}
                wallpaperLimitMiB={wallpaperLimitMiB}
              />
            </section>
            <section aria-labelledby="home-shortcuts-title">
              <h3 id="home-shortcuts-title">
                <UiCopy pt="Atalhos" en="Shortcuts" />
              </h3>
              <p>
                <UiCopy
                  pt="Escolha o que aparece na Home ou abra o modo de edição."
                  en="Choose what appears on Home or open edit mode."
                />
              </p>
              <button
                className="home-edit-shortcuts-button"
                type="button"
                onClick={() => {
                  dialog.current?.close();
                  onEditShortcuts();
                }}
              >
                <UiCopy
                  pt="Editar atalhos na Home →"
                  en="Edit shortcuts on Home →"
                />
              </button>
              <div className="home-customize-shortcuts">
                {shortcuts.map((shortcut) => (
                  <form key={shortcut.id} action={togglePersonalShortcutAction}>
                    <input type="hidden" name="id" value={shortcut.id} />
                    <input
                      type="hidden"
                      name="enabled"
                      value={shortcut.enabled ? "false" : "true"}
                    />
                    <span>{shortcut.name}</span>
                    <button
                      type="submit"
                      aria-label={`${shortcut.enabled ? "Ocultar" : "Mostrar"} ${shortcut.name}`}
                    >
                      {shortcut.enabled ? "Ocultar" : "Mostrar"}
                    </button>
                  </form>
                ))}
              </div>
              <Link
                href="/settings?section=personalization"
                onClick={() => dialog.current?.close()}
              >
                <UiCopy
                  pt="Adicionar e editar atalhos →"
                  en="Add and edit shortcuts →"
                />
              </Link>
            </section>
            <section aria-labelledby="home-widgets-title">
              <h3 id="home-widgets-title">
                <UiCopy
                  pt="Relógio e resumo Hoje"
                  en="Clock and Today summary"
                />
              </h3>
              <form className="stack-form" action={updateHomePreferencesAction}>
                <input type="hidden" name="theme" value={theme} />
                <label className="checkbox-label">
                  <input
                    name="homeClockEnabled"
                    type="checkbox"
                    value="true"
                    checked={clockShown}
                    onChange={(event) => setClockShown(event.target.checked)}
                  />{" "}
                  <UiCopy pt="Mostrar relógio" en="Show clock" />
                </label>
                <label>
                  <UiCopy pt="Posição do relógio" en="Clock position" />
                  <select
                    name="homeClockPosition"
                    value={selectedClockPosition}
                    onChange={(event) =>
                      setSelectedClockPosition(
                        event.target.value as typeof clockPosition,
                      )
                    }
                  >
                    <option value="top-left">
                      <UiCopy pt="Superior esquerdo" en="Top left" />
                    </option>
                    <option value="top-right">
                      <UiCopy pt="Superior direito" en="Top right" />
                    </option>
                    <option value="bottom-left">
                      <UiCopy pt="Inferior esquerdo" en="Bottom left" />
                    </option>
                    <option value="bottom-right">
                      <UiCopy pt="Inferior direito" en="Bottom right" />
                    </option>
                  </select>
                </label>
                <label className="checkbox-label">
                  <input
                    name="todayWidgetEnabled"
                    type="checkbox"
                    value="true"
                    checked={todayShown}
                    onChange={(event) => setTodayShown(event.target.checked)}
                  />{" "}
                  <UiCopy pt="Mostrar resumo Hoje" en="Show Today summary" />
                </label>
                <button type="submit">
                  <UiCopy pt="Salvar widgets" en="Save widgets" />
                </button>
              </form>
            </section>
            <section aria-labelledby="home-search-title">
              <h3 id="home-search-title">
                <UiCopy pt="Busca da Home" en="Home search" />
              </h3>
              <div className="stack-form">
                <label>
                  <UiCopy pt="Mecanismo de busca" en="Search provider" />
                  <select
                    name="searchEngine"
                    value={searchEngine}
                    disabled={searchPending}
                    onChange={(event) =>
                      onSearchEngineChange(
                        event.target.value as Appearance["searchEngine"],
                      )
                    }
                  >
                    <option value="google">Google</option>
                    <option value="scholar">
                      <UiCopy pt="Google Acadêmico" en="Google Scholar" />
                    </option>
                    <option value="duckduckgo">DuckDuckGo</option>
                    <option value="startpage">Startpage</option>
                    <option value="ecosia">Ecosia</option>
                  </select>
                </label>
                <small role="status" aria-live="polite">
                  {searchError
                    ? tr(
                        "Não foi possível salvar. Tente novamente.",
                        "Could not save. Try again.",
                      )
                    : searchPending
                      ? tr("Salvando escolha…", "Saving choice…")
                      : tr(
                          "A Home usa o mecanismo selecionado.",
                          "Home uses the selected provider.",
                        )}
                </small>
              </div>
            </section>
            {presentationAvailable ? (
              <HomePresentationControls
                initial={presentation}
                catalog={catalog}
              />
            ) : null}
            <Link
              className="home-customize-more"
              href="/settings?section=personalization"
              onClick={() => dialog.current?.close()}
            >
              <UiCopy
                pt="Gerenciar mais configurações →"
                en="Manage more settings →"
              />
            </Link>
          </div>
        </div>
      </dialog>
    </>
  );
}
