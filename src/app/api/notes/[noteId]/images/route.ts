import { NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/authorization";
import { assertToolAvailable } from "@/lib/v2/exam-access";
import { sameNoteRequestOrigin } from "@/lib/note-request-origin";
import { getReadableNote } from "@/lib/notes";
import { saveNoteImage } from "@/lib/note-images";
import { noteImageMaxBytes } from "@/lib/note-image-url";
export const dynamic = "force-dynamic";
export async function POST(
  request: Request,
  context: { params: Promise<{ noteId: string }> },
) {
  if (!sameNoteRequestOrigin(request.headers))
    return NextResponse.json({ error: "Origem inválida." }, { status: 403 });
  const session = await getCurrentSession();
  if (!session)
    return NextResponse.json(
      { error: "Entre novamente para enviar a imagem." },
      { status: 401 },
    );
  try {
    assertToolAvailable(session.user.id);
    const { noteId: raw } = await context.params;
    if (!/^\d+$/.test(raw) || !Number.isSafeInteger(Number(raw)))
      throw new Error("Note not found.");
    const noteId = Number(raw);
    if (!getReadableNote(session.user.id, noteId).editable)
      return NextResponse.json(
        { error: "Você tem acesso somente para leitura." },
        { status: 403 },
      );
    // A raw file body avoids unbounded multipart parsing; enforce the limit while reading.
    if (Number(request.headers.get("content-length")) > noteImageMaxBytes)
      return NextResponse.json(
        { error: "Escolha uma imagem de até 5 MB." },
        { status: 413 },
      );
    const reader = request.body?.getReader();
    if (!reader) throw new Error("Escolha uma imagem.");
    const chunks: Uint8Array[] = [];
    let size = 0;
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > noteImageMaxBytes) {
          await reader.cancel();
          return NextResponse.json(
            { error: "Escolha uma imagem de até 5 MB." },
            { status: 413 },
          );
        }
        chunks.push(value);
      }
    } finally {
      reader.releaseLock();
    }
    return NextResponse.json(
      await saveNoteImage(session.user.id, noteId, Buffer.concat(chunks)),
      { headers: { "cache-control": "no-store" } },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    return NextResponse.json(
      {
        error: /^(Escolha|Esta |Você)/.test(message)
          ? message
          : "Não foi possível enviar a imagem. Confira seu acesso e tente novamente.",
      },
      { status: message === "Note not found." ? 404 : 400 },
    );
  }
}
