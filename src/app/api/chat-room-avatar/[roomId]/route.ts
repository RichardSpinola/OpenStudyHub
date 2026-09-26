import { NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/authorization";
import { readChatRoomAvatar } from "@/lib/v2/chat-room-avatar";

export async function GET(
  _request: Request,
  context: { params: Promise<{ roomId: string }> },
) {
  const session = await getCurrentSession();
  if (!session) return new NextResponse(null, { status: 401 });
  const id = Number((await context.params).roomId);
  if (!Number.isSafeInteger(id) || id < 1)
    return new NextResponse(null, { status: 404 });
  const avatar = readChatRoomAvatar(session.user.id, id);
  if (!avatar) return new NextResponse(null, { status: 404 });
  return new NextResponse(new Uint8Array(avatar.image), {
    headers: {
      "cache-control": "private, no-cache",
      "content-type": avatar.mimeType,
      "x-content-type-options": "nosniff",
    },
  });
}
