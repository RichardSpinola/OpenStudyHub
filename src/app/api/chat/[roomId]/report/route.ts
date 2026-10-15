import { readSmallJson } from "@/lib/small-json";
import { NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/authorization";
import { assertToolAvailable } from "@/lib/v2/exam-access";
import { sameNoteRequestOrigin } from "@/lib/note-request-origin";
import { reportChatMessage } from "@/lib/chat-moderation";
export async function POST(
  request: Request,
  context: { params: Promise<{ roomId: string }> },
) {
  if (!sameNoteRequestOrigin(request.headers))
    return NextResponse.json({ error: "Origem inválida." }, { status: 403 });
  const session = await getCurrentSession();
  if (!session)
    return NextResponse.json({ error: "Sessão necessária." }, { status: 401 });
  try {
    assertToolAvailable(session.user.id);
    const body = (await readSmallJson(request, 5000)) as {
      messageId: number;
      reason: string;
    };
    if (!Number.isSafeInteger(body.messageId))
      throw new Error("Mensagem inválida.");
    const id = reportChatMessage(
      session.user.id,
      Number((await context.params).roomId),
      body.messageId,
      body.reason,
    );
    return NextResponse.json({ id });
  } catch {
    return NextResponse.json(
      { error: "Não foi possível enviar. Confira os campos e seu acesso." },
      { status: 400 },
    );
  }
}
