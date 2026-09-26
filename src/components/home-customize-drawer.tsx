"use client";
import { UiCopy, useUiText } from "@/components/ui-language-provider";


import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { IconPencil } from "@tabler/icons-react";

import {
  updateHomePreferencesAction,
  togglePersonalShortcutAction,
} from "@/app/settings/actions";
import { HomeBackgroundSettings } from "@/components/home-background-settings";
import type { WallpaperCatalog } from "@/lib/home-wallpapers";
import type { Shortcut } from "@/lib/shortcuts";
import type { Appearance } from "@/lib/appearance";

export function HomeCustomizeDrawer({
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
  const [selectedClockPosition, setSelectedClockPosition] = useState(clockPosition);
  const [clockShown, setClockShown] = useState(clockEnabled);
  const [todayShown, setTodayShown] = useState(todayWidgetEnabled);

  useEffect(() => setSelectedClockPosition(clockPosition), [clockPosition]);
  useEffect(() => setClockShown(clockEnabled), [clockEnabled]);
  useEffect(() => setTodayShown(todayWidgetEnabled), [todayWidgetEnabled]);

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

  function closeOutside(event: React.MouseEvent<HTMLDialogElement>) {
    if (event.target === dialog.current) dialog.current?.close();
  }

  return (
    <>
      <button
        ref={trigger}
        className="home-customize-trigger"
        data-clock-position={clockEnabled ? clockPosition : "none"}
        type="button"
        aria-label="Personalizar Home"
        onClick={() => dialog.current?.showModal()}
      >
        <IconPencil size={20} aria-hidden="true" />
      </button>
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
              <h2 id="home-customize-title"><UiCopy pt="Personalizar" en="Customize" /></h2>
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
              <h3 id="home-wallpaper-title"><UiCopy pt="Fundo da Home" en="Home background" /></h3>
              <HomeBackgroundSettings
                configured={false}
                catalog={catalog}
                wallpaperLimitMiB={wallpaperLimitMiB}
              />
            </section>
            <section aria-labelledby="home-shortcuts-title">
              <h3 id="home-shortcuts-title"><UiCopy pt="Atalhos" en="Shortcuts" /></h3>
              <p><UiCopy pt="Escolha o que aparece na Home ou abra o modo de edição." en="Choose what appears on Home or open edit mode." /></p>
              <button
                className="home-edit-shortcuts-button"
                type="button"
                onClick={() => {
                  dialog.current?.close();
                  onEditShortcuts();
                }}
              ><UiCopy pt="Editar atalhos na Home →" en="Edit shortcuts on Home →" /></button>
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
              ><UiCopy pt="Adicionar e editar atalhos →" en="Add and edit shortcuts →" /></Link>
            </section>
            <section aria-labelledby="home-widgets-title">
              <h3 id="home-widgets-title"><UiCopy pt="Relógio e resumo Hoje" en="Clock and Today summary" /></h3>
              <form className="stack-form" action={updateHomePreferencesAction}>
                <input type="hidden" name="theme" value={theme} />
                <label className="checkbox-label">
                  <input
                    name="homeClockEnabled"
                    type="checkbox"
                    value="true"
                    checked={clockShown}
                    onChange={(event) => setClockShown(event.target.checked)}
                  />{" "}<UiCopy pt="Mostrar relógio" en="Show clock" />
                </label>
                <label><UiCopy pt="Posição do relógio" en="Clock position" /><select name="homeClockPosition" value={selectedClockPosition} onChange={(event) => setSelectedClockPosition(event.target.value as typeof clockPosition)}>
                    <option value="top-left"><UiCopy pt="Superior esquerdo" en="Top left" /></option>
                    <option value="top-right"><UiCopy pt="Superior direito" en="Top right" /></option>
                    <option value="bottom-left"><UiCopy pt="Inferior esquerdo" en="Bottom left" /></option>
                    <option value="bottom-right"><UiCopy pt="Inferior direito" en="Bottom right" /></option>
                  </select>
                </label>
                <label className="checkbox-label">
                  <input
                    name="todayWidgetEnabled"
                    type="checkbox"
                    value="true"
                    checked={todayShown}
                    onChange={(event) => setTodayShown(event.target.checked)}
                  />{" "}<UiCopy pt="Mostrar resumo Hoje" en="Show Today summary" />
                </label>
                <button type="submit"><UiCopy pt="Salvar widgets" en="Save widgets" /></button>
              </form>
            </section>
            <section aria-labelledby="home-search-title">
              <h3 id="home-search-title"><UiCopy pt="Busca da Home" en="Home search" /></h3>
              <div className="stack-form">
                <label><UiCopy pt="Mecanismo de busca" en="Search provider" /><select
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
                    <option value="scholar"><UiCopy pt="Google Acadêmico" en="Google Scholar" /></option>
                    <option value="duckduckgo">DuckDuckGo</option>
                    <option value="startpage">Startpage</option>
                    <option value="ecosia">Ecosia</option>
                  </select>
                </label>
                <small role="status" aria-live="polite">
                  {searchError
                    ? tr("Não foi possível salvar. Tente novamente.", "Could not save. Try again.")
                    : searchPending
                      ? tr("Salvando escolha…", "Saving choice…")
                      : tr("A Home usa o mecanismo selecionado.", "Home uses the selected provider.")}
                </small>
              </div>
            </section>
            <Link
              className="home-customize-more"
              href="/settings?section=personalization"
              onClick={() => dialog.current?.close()}
            ><UiCopy pt="Gerenciar mais configurações →" en="Manage more settings →" /></Link>
          </div>
        </div>
      </dialog>
    </>
  );
}
