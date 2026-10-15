"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { createNoteAction } from "@/app/notes/actions";
import { UiCopy } from "@/components/ui-language-provider";
import { PendingSubmitButton } from "@/components/pending-submit-button";
export type NoteNavigationItem = {
  id: number;
  title: string;
  parentNoteId: number | null;
};
export function NoteNavigation({
  notes: sourceNotes,
  shared: sourceShared,
  activeId,
}: {
  notes: NoteNavigationItem[];
  shared: NoteNavigationItem[];
  activeId?: number;
}) {
  const [titles, setTitles] = useState<Record<number, string>>({});
  useEffect(() => {
    const listener = (e: Event) => {
      const v = (e as CustomEvent<{ id: number; title: string }>).detail;
      if (v) setTitles((previous) => ({ ...previous, [v.id]: v.title }));
    };
    window.addEventListener("osh:note-title", listener);
    return () => window.removeEventListener("osh:note-title", listener);
  }, []);
  const notes = sourceNotes.map((n) => ({
    ...n,
    title: titles[n.id] ?? n.title,
  }));
  const shared = sourceShared.map((n) => ({
    ...n,
    title: titles[n.id] ?? n.title,
  }));
  const ids = new Set(notes.map((n) => n.id));
  function tree(parent: number | null, seen = new Set<number>()): ReactNode {
    if (seen.size > 15) return null;
    return (
      <ul>
        {notes
          .filter(
            (n) =>
              n.parentNoteId === parent ||
              (parent === null &&
                n.parentNoteId !== null &&
                !ids.has(n.parentNoteId)),
          )
          .map((n) => {
            if (seen.has(n.id)) return null;
            const children = notes.some((c) => c.parentNoteId === n.id);
            const chain = new Set(seen).add(n.id);
            return (
              <li key={n.id}>
                {children ? (
                  <details
                    open={
                      n.id === activeId || descendant(n.id, activeId, notes)
                    }
                  >
                    <summary>
                      <Link
                        href={`/notes/${n.id}`}
                        aria-current={n.id === activeId ? "page" : undefined}
                      >
                        {n.title}
                      </Link>
                    </summary>
                    {tree(n.id, chain)}
                  </details>
                ) : (
                  <Link
                    href={`/notes/${n.id}`}
                    aria-current={n.id === activeId ? "page" : undefined}
                  >
                    <span aria-hidden="true">▤</span> {n.title}
                  </Link>
                )}
              </li>
            );
          })}
      </ul>
    );
  }
  return (
    <aside className="note-page-navigation">
      <Link className="note-nav-title" href="/notes">
        <UiCopy pt="Notas" en="Notes" />
      </Link>
      <form action={createNoteAction}>
        <input name="title" type="hidden" value="Sem título" />
        <input name="content" type="hidden" value="" />
        <PendingSubmitButton pendingLabel="…">
          <UiCopy pt="+ Nova página" en="+ New page" />
        </PendingSubmitButton>
      </form>
      <form method="get" action="/notes" className="note-nav-search">
        <input
          name="q"
          aria-label="Buscar páginas"
          placeholder="Buscar páginas…"
          maxLength={200}
        />
        <button aria-label="Buscar">⌕</button>
      </form>
      <p className="note-nav-section">
        <UiCopy pt="Suas páginas" en="Your pages" />
      </p>
      {notes.length ? (
        tree(null)
      ) : (
        <p className="note-muted">
          <UiCopy
            pt="Sua primeira página começa acima."
            en="Start your first page above."
          />
        </p>
      )}
      {shared.length ? (
        <>
          <p className="note-nav-section">
            <UiCopy pt="Compartilhadas comigo" en="Shared with me" />
          </p>
          <ul>
            {shared.map((n) => (
              <li key={n.id}>
                <Link
                  href={`/notes/${n.id}`}
                  aria-current={n.id === activeId ? "page" : undefined}
                >
                  ♧ {n.title}
                </Link>
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </aside>
  );
}
function descendant(
  id: number,
  active: number | undefined,
  notes: NoteNavigationItem[],
): boolean {
  const seen = new Set<number>();
  let current = notes.find((n) => n.id === active);
  while (current?.parentNoteId && !seen.has(current.id)) {
    seen.add(current.id);
    if (current.parentNoteId === id) return true;
    current = notes.find((n) => n.id === current?.parentNoteId);
  }
  return false;
}
