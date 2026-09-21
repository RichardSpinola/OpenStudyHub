import { NextResponse, type NextRequest } from "next/server";

import { getCurrentSession } from "@/lib/authorization";
import { completeGoogleAuthorization } from "@/lib/google/oauth";

export async function GET(request: NextRequest) {
  const session = await getCurrentSession();
  if (!session)
    return NextResponse.redirect(new URL("/login", request.url), 303);

  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  const denied = request.nextUrl.searchParams.has("error");
  if (denied || !code || !state) {
    return NextResponse.redirect(
      new URL("/settings?google=cancelled", request.url),
      303,
    );
  }

  try {
    await completeGoogleAuthorization(session.user.id, code, state);
    return NextResponse.redirect(
      new URL("/settings?google=connected", request.url),
      303,
    );
  } catch {
    return NextResponse.redirect(
      new URL("/settings?google=error", request.url),
      303,
    );
  }
}
