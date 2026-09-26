import { type NextRequest, NextResponse } from "next/server";

import { buildWebSearchUrl } from "@/lib/search";
import { requireAuthenticatedUser } from "@/lib/authorization";
import { getAppearance } from "@/lib/appearance";

export async function GET(request: NextRequest) {
  const user = await requireAuthenticatedUser();
  const destination = buildWebSearchUrl(
    request.nextUrl.searchParams.get("q") ?? "",
    getAppearance(user.id).searchEngine,
  );

  if (!destination) {
    const home = new URL("/", request.url);
    home.searchParams.set("search", "empty");
    return NextResponse.redirect(home);
  }

  return NextResponse.redirect(destination);
}
