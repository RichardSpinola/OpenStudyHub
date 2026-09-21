import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { getCurrentSession } from "@/lib/authorization";
import {
  countUnreadNotifications,
  getNotificationPreferences,
  listNotifications,
  markNotificationRead,
} from "@/lib/notifications";
import { isSameOriginRequest } from "@/lib/request-security";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const session = await getCurrentSession();
  if (!session)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const after = z.coerce
    .number()
    .int()
    .min(0)
    .catch(0)
    .parse(request.nextUrl.searchParams.get("after"));
  return NextResponse.json({
    notifications: listNotifications(session.user.id, after),
    unread: countUnreadNotifications(session.user.id),
    preferences: getNotificationPreferences(session.user.id),
  });
}

export async function PATCH(request: NextRequest) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ error: "invalid-origin" }, { status: 403 });
  }
  const session = await getCurrentSession();
  if (!session)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try {
    const input = z
      .object({ notificationId: z.number().int().positive() })
      .parse(await request.json());
    markNotificationRead(session.user.id, input.notificationId);
    return new NextResponse(null, { status: 204 });
  } catch {
    return NextResponse.json(
      { error: "invalid-notification" },
      { status: 400 },
    );
  }
}
