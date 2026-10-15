import { type NextRequest, NextResponse } from "next/server";

import { assertToolAvailable } from "@/lib/v2/exam-access";
import { getCurrentSession } from "@/lib/authorization";
import {
  exportNoteAsHtml,
  exportNoteAsMarkdown,
  noteExportFilename,
} from "@/lib/note-export";
import { readNoteImage } from "@/lib/note-images";
import { getReadableNote } from "@/lib/notes";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ noteId: string }> },
) {
  const session = await getCurrentSession();
  if (!session) return new NextResponse("Unauthorized", { status: 401 });
  const rawId = (await context.params).noteId;
  if (!/^\d+$/.test(rawId)) {
    return new NextResponse("Not found", { status: 404 });
  }

  try {
    assertToolAvailable(session.user.id);
  } catch {
    return new NextResponse("Unavailable", { status: 403 });
  }
  let note;
  try {
    note = getReadableNote(session.user.id, Number(rawId));
  } catch {
    return new NextResponse("Not found", { status: 404 });
  }
  const format = request.nextUrl.searchParams.get("format");
  if (format !== "md" && format !== "html") {
    return new NextResponse("Unsupported format", { status: 400 });
  }
  const images: Record<string, string> = {};
  if (format === "html") {
    const ids = [
      ...new Set(
        [...note.content.matchAll(/\/api\/note-images\/([0-9a-f-]{36})/gi)].map(
          (match) => match[1],
        ),
      ),
    ];
    for (const id of ids) {
      const image = readNoteImage(session.user.id, id);
      if (image)
        images[`/api/note-images/${id}`] =
          `data:${image.mimeType};base64,${image.data.toString("base64")}`;
    }
  }
  const body =
    format === "md"
      ? exportNoteAsMarkdown(note)
      : exportNoteAsHtml(note, images);
  const filename = `${noteExportFilename(note)}.${format}`;
  return new NextResponse(body, {
    headers: {
      "content-type":
        format === "md"
          ? "text/markdown; charset=utf-8"
          : "text/html; charset=utf-8",
      "content-disposition": `attachment; filename="${filename}"`,
      "x-content-type-options": "nosniff",
      "cache-control": "no-store",
    },
  });
}
