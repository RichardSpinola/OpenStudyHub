import { type NextRequest, NextResponse } from "next/server";

import { getCurrentSession } from "@/lib/authorization";
import {
  exportNoteAsHtml,
  exportNoteAsMarkdown,
  noteExportFilename,
} from "@/lib/note-export";
import { getUserNote } from "@/lib/notes";

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

  let note;
  try {
    note = getUserNote(session.user.id, Number(rawId));
  } catch {
    return new NextResponse("Not found", { status: 404 });
  }
  const format = request.nextUrl.searchParams.get("format");
  if (format !== "md" && format !== "html") {
    return new NextResponse("Unsupported format", { status: 400 });
  }
  const body =
    format === "md" ? exportNoteAsMarkdown(note) : exportNoteAsHtml(note);
  const filename = `${noteExportFilename(note)}.${format}`;
  return new NextResponse(body, {
    headers: {
      "content-type":
        format === "md"
          ? "text/markdown; charset=utf-8"
          : "text/html; charset=utf-8",
      "content-disposition": `attachment; filename="${filename}"`,
      "x-content-type-options": "nosniff",
    },
  });
}
