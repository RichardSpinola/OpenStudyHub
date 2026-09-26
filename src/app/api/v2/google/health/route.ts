import { NextRequest, NextResponse } from "next/server";
import { withV2DbAsync, currentUserV2 } from "@/lib/v2/runtime";
import {
  checkGoogleHealthForUser,
  dismissGoogleHealthIncident,
  googleHealthStatus,
} from "@/lib/v2/google-health";
export const dynamic = "force-dynamic";
export async function GET() {
  if (process.env.OPENSTUDYHUB_V2_ENABLED !== "1")
    return NextResponse.json({ error: "unavailable" }, { status: 404 });
  return withV2DbAsync(async (db) => {
    const user = await currentUserV2(db);
    if (!user || user.kind !== "user" || user.mustChangePassword)
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    await checkGoogleHealthForUser(db, user.id);
    return NextResponse.json(googleHealthStatus(db, user.id), {
      headers: { "cache-control": "private, no-store" },
    });
  });
}
export async function POST(request: NextRequest) {
  if (
    request.headers.get("origin") !==
    new URL(process.env.APP_URL ?? request.url).origin
  )
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  return withV2DbAsync(async (db) => {
    const user = await currentUserV2(db);
    if (!user || user.kind !== "user" || user.mustChangePassword)
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    dismissGoogleHealthIncident(db, user.id);
    return NextResponse.json(googleHealthStatus(db, user.id));
  });
}
