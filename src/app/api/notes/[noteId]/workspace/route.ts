import { NextResponse } from "next/server";
import { sameNoteRequestOrigin } from "@/lib/note-request-origin";
import { getCurrentSession } from "@/lib/authorization";
import { assertToolAvailable } from "@/lib/v2/exam-access";
import {
  decodeNoteUpdate,
  initializeNoteWorkspace,
  mergeNoteWorkspace,
} from "@/lib/note-workspace";
export const dynamic = "force-dynamic";

async function identity(context: { params: Promise<{ noteId: string }> }) {
  const session = await getCurrentSession();
  if (!session) throw new Error("SESSION");
  assertToolAvailable(session.user.id);
  const { noteId } = await context.params;
  if (!/^\d+$/.test(noteId) || !Number.isSafeInteger(Number(noteId)))
    throw new Error("Note not found.");
  return { userId: session.user.id, noteId: Number(noteId) };
}
function failure(error: unknown) {
  const raw = error instanceof Error ? error.message : "";
  const status =
    raw === "SESSION"
      ? 401
      : raw === "Note not found."
        ? 404
        : /leitura|prova/.test(raw)
          ? 403
          : 400;
  const message =
    raw === "SESSION"
      ? "Entre novamente para continuar."
      : status === 404
        ? "Página indisponível."
        : /^(Você|Use |Esta |A |Reabra|Atualização|Campo|Recurso)/.test(raw)
          ? raw
          : "Não foi possível sincronizar. O rascunho continua disponível neste navegador; tente novamente ou baixe uma cópia.";
  return NextResponse.json(
    { error: message },
    { status, headers: { "cache-control": "no-store" } },
  );
}
export async function GET(
  request: Request,
  context: { params: Promise<{ noteId: string }> },
) {
  try {
    const { userId, noteId } = await identity(context);
    const packet = await initializeNoteWorkspace(userId, noteId);
    const etag = `"${packet.revision}-${Number(packet.editable)}"`;
    if (request.headers.get("if-none-match") === etag)
      return new NextResponse(null, {
        status: 304,
        headers: { "cache-control": "no-store", etag },
      });
    return NextResponse.json(packet, {
      headers: { "cache-control": "no-store", etag },
    });
  } catch (error) {
    return failure(error);
  }
}
export async function POST(
  request: Request,
  context: { params: Promise<{ noteId: string }> },
) {
  try {
    if (!sameNoteRequestOrigin(request.headers))
      return NextResponse.json({ error: "Origem inválida." }, { status: 403 });
    const { userId, noteId } = await identity(context);
    if (Number(request.headers.get("content-length")) > 2_000_100)
      return NextResponse.json(
        { error: "Atualização grande demais." },
        { status: 413 },
      );
    const text = await request.text();
    if (text.length > 2_000_100)
      return NextResponse.json(
        { error: "Atualização grande demais." },
        { status: 413 },
      );
    const input = JSON.parse(text) as { update?: unknown };
    if (typeof input.update !== "string")
      return NextResponse.json(
        { error: "Atualização inválida." },
        { status: 400 },
      );
    return NextResponse.json(
      mergeNoteWorkspace(userId, noteId, decodeNoteUpdate(input.update)),
      { headers: { "cache-control": "no-store" } },
    );
  } catch (error) {
    return failure(error);
  }
}
