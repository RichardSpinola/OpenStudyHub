import type { NoteRecord } from "@/lib/notes";

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function noteExportFilename(note: Pick<NoteRecord, "title">): string {
  const safe = note.title
    .normalize("NFKD")
    .replaceAll(/[^\p{L}\p{N}._ -]+/gu, "")
    .trim()
    .replaceAll(/\s+/g, "-")
    .slice(0, 100);
  return safe || "note";
}

export function exportNoteAsMarkdown(note: NoteRecord): string {
  const context = [note.subjectName, note.activityTitle]
    .filter(Boolean)
    .join(" · ");
  return `# ${note.title}\n${context ? `\n${context}\n` : ""}\n${note.content}\n`;
}

export function exportNoteAsHtml(note: NoteRecord): string {
  const context = [note.subjectName, note.activityTitle]
    .filter(Boolean)
    .join(" · ");
  return `<!doctype html>
<html lang="pt-BR">
<head><meta charset="utf-8"><title>${escapeHtml(note.title)}</title></head>
<body><main><h1>${escapeHtml(note.title)}</h1>${context ? `<p>${escapeHtml(context)}</p>` : ""}<pre>${escapeHtml(note.content)}</pre></main></body>
</html>\n`;
}
