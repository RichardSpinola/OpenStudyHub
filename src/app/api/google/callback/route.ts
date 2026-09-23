import { NextResponse, type NextRequest } from "next/server";

import { getCurrentSession } from "@/lib/authorization";
import { completeGoogleAuthorization } from "@/lib/google/oauth";
import { getServerEnvironment } from "@/lib/env";
import { getGoogleIntegrationAvailability } from "@/lib/google/config";

export async function GET(request: NextRequest) {
  const environment = getServerEnvironment();
  if (
    environment.NODE_ENV === "production" &&
    !getGoogleIntegrationAvailability(environment).configured
  )
    return new NextResponse("Configuração Google inválida.", { status: 503 });
  const target = (path: string) => new URL(path, environment.APP_URL);
  if (process.env.OPENSTUDYHUB_V2_ENABLED === "1")
    return NextResponse.redirect(
      target("/google?error=Reconecte+na+integração+V2"),
      303,
    );
  const session = await getCurrentSession();
  if (!session) return NextResponse.redirect(target("/login"), 303);

  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  const denied = request.nextUrl.searchParams.has("error");
  if (denied || !code || !state) {
    return NextResponse.redirect(target("/settings?google=cancelled"), 303);
  }

  try {
    await completeGoogleAuthorization(session.user.id, code, state);
    return NextResponse.redirect(target("/settings?google=connected"), 303);
  } catch {
    return NextResponse.redirect(target("/settings?google=error"), 303);
  }
}
