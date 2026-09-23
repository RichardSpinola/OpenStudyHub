import { NextResponse } from "next/server";

import { getCurrentSession } from "@/lib/authorization";
import { getGooglePickerConfig } from "@/lib/google/config";
import { getGoogleAccessToken } from "@/lib/google/oauth";
import { currentUserV2, withV2DbAsync } from "@/lib/v2/runtime";
import { DRIVE_SCOPE } from "@/lib/v2/google-config";
import {
  googleAccessTokenV2,
  googleConnectionStatus,
} from "@/lib/v2/google-oauth";
import {
  fakeGoogleConfig,
  fakeGoogleEnabled,
  fakeGoogleFetch,
} from "@/lib/v2/fake-google";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getCurrentSession();
  if (!session)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const picker = getGooglePickerConfig();
  if (!picker)
    return NextResponse.json({ error: "not-configured" }, { status: 404 });
  if (process.env.OPENSTUDYHUB_V2_ENABLED === "1") {
    try {
      const accessToken = await withV2DbAsync(async (db) => {
        const user = await currentUserV2(db);
        if (!user || user.mustChangePassword) return null;
        const connection = googleConnectionStatus(db, user.id);
        if (
          connection?.status !== "connected" ||
          !connection.scopes.split(" ").includes(DRIVE_SCOPE)
        )
          return null;
        const fake = fakeGoogleEnabled();
        return googleAccessTokenV2(
          db,
          user.id,
          fake
            ? {
                config: fakeGoogleConfig(),
                fetchImpl: fakeGoogleFetch(db, user.id),
              }
            : {},
        );
      });
      if (!accessToken)
        return NextResponse.json(
          { error: "google-unavailable" },
          { status: 403 },
        );
      return NextResponse.json(
        { accessToken, apiKey: picker.apiKey, appId: picker.appId },
        { headers: { "cache-control": "private, no-store" } },
      );
    } catch {
      return NextResponse.json(
        { error: "google-unavailable" },
        { status: 503 },
      );
    }
  }
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
