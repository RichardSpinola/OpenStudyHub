import { NextRequest, NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/authorization";
import { isSameOriginRequest } from "@/lib/request-security";
import { canonicalChatUserId } from "@/lib/v2/chat-state";
import { pushConfiguration, removePushSubscription, savePushSubscription } from "@/lib/v2/push";
import { withV2Db } from "@/lib/v2/runtime";
import { getNotificationPreferences, updateNotificationPreferences } from "@/lib/notifications";

export async function GET() {
  if (!(await getCurrentSession())) return new NextResponse(null, { status: 401 });
  const config = pushConfiguration();
  return NextResponse.json({ available: Boolean(config), publicKey: config?.publicKey ?? null }, { headers: { "cache-control": "no-store" } });
}
export async function POST(request: NextRequest) {
  if (!isSameOriginRequest(request)) return new NextResponse(null, { status: 403 });
  const session = await getCurrentSession();
  if (!session) return new NextResponse(null, { status: 401 });
  if (!pushConfiguration()) return new NextResponse(null, { status: 503 });
  try {
    const userId = withV2Db((db) => canonicalChatUserId(db, session.user.id));
    savePushSubscription(userId, await request.json());
    updateNotificationPreferences(session.user.id, { ...getNotificationPreferences(session.user.id), desktopEnabled: true });
    return new NextResponse(null, { status: 204 });
  } catch { return NextResponse.json({ error: "invalid-subscription" }, { status: 400 }); }
}
export async function DELETE(request: NextRequest) {
  if (!isSameOriginRequest(request)) return new NextResponse(null, { status: 403 });
  const session = await getCurrentSession();
  if (!session) return new NextResponse(null, { status: 401 });
  try {
    const userId = withV2Db((db) => canonicalChatUserId(db, session.user.id));
    const input = await request.json() as { endpoint?: unknown };
    removePushSubscription(userId, input.endpoint);
    return new NextResponse(null, { status: 204 });
  } catch { return NextResponse.json({ error: "invalid-subscription" }, { status: 400 }); }
}
