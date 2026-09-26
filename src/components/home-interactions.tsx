"use client";
import { UiCopy } from "@/components/ui-language-provider";


import { useState, useTransition } from "react";

import {
  reorderShortcutsAction,
  updateHomeSearchAction,
} from "@/app/settings/actions";
import { HomeCustomizeDrawer } from "@/components/home-customize-drawer";
import { SearchForm } from "@/components/search-form";
import { ShortcutGrid } from "@/components/shortcut-grid";
import type { Appearance } from "@/lib/appearance";
import type { WallpaperCatalog } from "@/lib/home-wallpapers";
import type { Shortcut } from "@/lib/shortcuts";

export function HomeInteractions({
  shortcuts,
  available,
  unavailableMessage,
  catalog,
  wallpaperLimitMiB,
  appearance,
  theme,
  clockEnabled,
  clockPosition,
  todayWidgetEnabled,
}: {
  shortcuts: Shortcut[];
  available: boolean;
  unavailableMessage: string;
  catalog: WallpaperCatalog;
  wallpaperLimitMiB: 5 | 10;
  appearance: Appearance;
  theme: "dark" | "light";
  clockEnabled: boolean;
  clockPosition: "top-left" | "top-right" | "bottom-left" | "bottom-right";
  todayWidgetEnabled: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const shortcutKey = shortcuts
    .filter((item) => item.enabled)
    .map((item) => item.id)
    .join(",");
  const [orderState, setOrderState] = useState(() => ({
    sourceKey: shortcutKey,
    ids: shortcuts.filter((item) => item.enabled).map((item) => item.id),
  }));
  const [orderError, setOrderError] = useState(false);
  const [orderPending, startOrderTransition] = useTransition();
  const [engine, setEngine] = useState(appearance.searchEngine);
  const [searchPending, setSearchPending] = useState(false);
  const [searchError, setSearchError] = useState(false);

  const orderedIds =
    orderState.sourceKey === shortcutKey
      ? orderState.ids
      : shortcuts.filter((item) => item.enabled).map((item) => item.id);
  const enabled = orderedIds
    .map((id) => shortcuts.find((item) => item.id === id && item.enabled))
    .filter((item): item is Shortcut => item !== undefined);
  for (const shortcut of shortcuts) {
    if (shortcut.enabled && !enabled.some((item) => item.id === shortcut.id))
      enabled.push(shortcut);
  }

  function moveShortcut(id: number, direction: -1 | 1) {
    const currentIds = enabled.map((item) => item.id);
    const index = currentIds.indexOf(id);
    const nextIndex = index + direction;
    if (index < 0 || nextIndex < 0 || nextIndex >= currentIds.length) return;
    const previous = [...currentIds];
    const [moved] = currentIds.splice(index, 1);
    currentIds.splice(nextIndex, 0, moved);
    setOrderState({ sourceKey: shortcutKey, ids: currentIds });
    setOrderError(false);
    startOrderTransition(async () => {
      try {
        await reorderShortcutsAction(currentIds);
      } catch {
        setOrderState({ sourceKey: shortcutKey, ids: previous });
        setOrderError(true);
      }
    });
  }

  async function changeEngine(next: Appearance["searchEngine"]) {
    const previous = engine;
    setEngine(next);
    setSearchPending(true);
    setSearchError(false);
    try {
      const data = new FormData();
      data.set("searchEngine", next);
      await updateHomeSearchAction(data);
    } catch {
      setEngine(previous);
      setSearchError(true);
    } finally {
      setSearchPending(false);
    }
  }

  return (
    <>
      {available ? (
        <HomeCustomizeDrawer
          catalog={catalog}
          wallpaperLimitMiB={wallpaperLimitMiB}
          shortcuts={shortcuts}
          searchEngine={engine}
          searchPending={searchPending}
          searchError={searchError}
          onSearchEngineChange={(next) => void changeEngine(next)}
          onEditShortcuts={() => setEditing(true)}
          theme={theme}
          clockEnabled={clockEnabled}
          clockPosition={clockPosition}
          todayWidgetEnabled={todayWidgetEnabled}
        />
      ) : null}
      <SearchForm engine={engine} />
      <div className="shortcut-section" data-editing={editing}>
        {editing ? (
          <div className="home-shortcut-edit-header" role="status">
            <span><UiCopy pt="Organize seus atalhos com as setas" en="Arrange your shortcuts with the arrows" /></span>
            <button type="button" onClick={() => setEditing(false)}><UiCopy pt="Concluir edição" en="Finish editing" /></button>
          </div>
        ) : null}
        {orderError ? (
          <p className="feedback-banner is-error" role="alert"><UiCopy pt="A nova ordem não foi salva. Tente novamente." en="The new order was not saved. Try again." /></p>
        ) : null}
        {available ? (
          <ShortcutGrid
            shortcuts={enabled}
            canManage={!editing}
            editing={editing}
            orderPending={orderPending}
            onMove={moveShortcut}
          />
        ) : (
          <div className="empty-state" role="status">
            {unavailableMessage}
          </div>
        )}
      </div>
    </>
  );
}
