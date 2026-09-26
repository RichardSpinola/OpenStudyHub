import Link from "next/link";

import type { NoteRecord } from "@/lib/notes";
import type { UiLanguage } from "@/lib/ui-language";

export function NoteLibraryCard({
  note,
  href,
  shared = false,
  ownerName,
  language = "pt-BR",
}: {
  note: NoteRecord;
  href: string;
  shared?: boolean;
  ownerName?: string;
  language?: UiLanguage;
}) {
  const english = language === "en";
  const preview = note.content
    .replaceAll(
      /```[\s\S]*?```/gu,
      english ? "Code snippet" : "Trecho de código",
    )
    .replaceAll(/\[([^\]]+)\]\([^)]+\)/gu, "$1")
    .replaceAll(/[#>*_`]/gu, "")
    .trim();
  const date = new Intl.DateTimeFormat(language, {
    dateStyle: "medium",
  }).format(note.updatedAt);

  return (
    <li className="note-library-card">
      <Link
        href={href}
        aria-label={`${english ? "Open note" : "Abrir nota"} ${note.title}`}
      >
        <span className="note-sheet">
          <span className="note-sheet-topline">
            <span>
              {note.subjectName ?? (english ? "Free note" : "Nota livre")}
            </span>
            <span aria-hidden="true">✦</span>
          </span>
          <strong>{note.title}</strong>
          <span className="note-sheet-preview">
            {preview ||
              (english
                ? "Start writing in this note…"
                : "Comece a escrever nesta nota…")}
          </span>
        </span>
        <span className="note-card-footer">
          <span>
            <strong>{note.title}</strong>
            <small>
              {note.activityTitle
                ? `${note.subjectName} · ${note.activityTitle}`
                : (note.subjectName ??
                  (english ? "No subject" : "Sem disciplina"))}
            </small>
          </span>
          <span className="note-card-aside">
            <time dateTime={new Date(note.updatedAt).toISOString()}>
              {date}
            </time>
            <small>
              {shared
                ? `${english ? "Shared" : "Compartilhada"}${ownerName ? ` ${english ? "by" : "por"} ${ownerName}` : ""}`
                : english
                  ? "Private"
                  : "Privada"}
            </small>
          </span>
        </span>
      </Link>
    </li>
  );
}
