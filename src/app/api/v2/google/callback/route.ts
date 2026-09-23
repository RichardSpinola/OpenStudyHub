import { NextRequest, NextResponse } from "next/server";
import { withV2DbAsync, currentUserV2 } from "@/lib/v2/runtime";
import { completeGoogleV2 } from "@/lib/v2/google-oauth";
import { requireGoogleV2Config } from "@/lib/v2/google-config";

export async function GET(request: NextRequest) {
  let origin: string;
  try {
    origin = new URL(requireGoogleV2Config().redirectUri).origin;
  } catch {
    return new NextResponse("Configuração Google inválida.", { status: 503 });
  }
  const target = (status: string) =>
    new URL("/google?google=" + status, origin);
  if (request.nextUrl.searchParams.has("error"))
    return NextResponse.redirect(target("cancelled"), 303);
  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  if (!code || !state) return NextResponse.redirect(target("error"), 303);
  try {
    await withV2DbAsync(async (db) => {
      const user = await currentUserV2(db);
      if (!user || user.mustChangePassword)
        throw new Error("Sessão normal necessária.");
      await completeGoogleV2(db, user.id, code, state);
    });
    return NextResponse.redirect(target("connected"), 303);
  } catch {
    return NextResponse.redirect(target("error"), 303);
  }
}
