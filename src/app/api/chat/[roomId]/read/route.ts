import { NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/authorization";
import { isSameOriginRequest } from "@/lib/request-security";
import { changePersonalRoomState } from "@/lib/v2/chat-state";

export async function POST(request: Request, context: { params: Promise<{ roomId: string }> }) {
  if (!isSameOriginRequest(request)) return new NextResponse(null, { status: 403 });
  const session = await getCurrentSession();
  if (!session) return new NextResponse(null, { status: 401 });
  try {
    const roomId = Number((await context.params).roomId);
    changePersonalRoomState(session.user.id, roomId, "read");
    return new NextResponse(null, { status: 204 });
  } catch { return new NextResponse(null, { status: 403 }); }
}
