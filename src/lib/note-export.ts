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

export function exportNoteAsHtml(
  note: NoteRecord,
  imageSources: Record<string, string> = {},
): string {
  const context = [note.subjectName, note.activityTitle]
    .filter(Boolean)
    .join(" · ");
  // Only data URLs supplied by the authenticated export route become images.
  const parts = note.content.split(
    /(!\[[^\]]*\]\(<\/api\/note-images\/[0-9a-f-]{36}>\))/gi,
  );
  const content = parts
    .map((part) => {
      const match =
        /^!\[([^\]]*)\]\(<(\/api\/note-images\/[0-9a-f-]{36})>\)$/i.exec(part);
      const source = match ? imageSources[match[2]] : undefined;
      return match &&
        source &&
        /^data:image\/webp;base64,[A-Za-z0-9+/=]+$/.test(source)
        ? `<figure><img src="${source}" alt="${escapeHtml(match[1])}" style="max-width:100%;height:auto"><figcaption>${escapeHtml(match[1])}</figcaption></figure>`
        : `<pre style="white-space:pre-wrap">${escapeHtml(part)}</pre>`;
    })
    .join("");
  return `<!doctype html>
<html lang="pt-BR">
<head><meta charset="utf-8"><title>${escapeHtml(note.title)}</title></head>
<body><main><h1>${escapeHtml(note.title)}</h1>${context ? `<p>${escapeHtml(context)}</p>` : ""}${content}</main></body>
</html>\n`;
}
