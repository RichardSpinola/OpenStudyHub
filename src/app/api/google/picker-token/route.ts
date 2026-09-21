import { NextResponse } from "next/server";

import { getCurrentSession } from "@/lib/authorization";
import { getGooglePickerConfig } from "@/lib/google/config";
import { getGoogleAccessToken } from "@/lib/google/oauth";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getCurrentSession();
  if (!session)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const picker = getGooglePickerConfig();
  if (!picker)
    return NextResponse.json({ error: "not-configured" }, { status: 404 });
  try {
    return NextResponse.json(
      {
        accessToken: await getGoogleAccessToken(session.user.id),
        apiKey: picker.apiKey,
        appId: picker.appId,
      },
      { headers: { "cache-control": "private, no-store" } },
    );
  } catch {
    return NextResponse.json({ error: "google-unavailable" }, { status: 503 });
  }
}
