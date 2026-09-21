import { type NextRequest, NextResponse } from "next/server";

import { buildWebSearchUrl } from "@/lib/search";
import { requireAuthenticatedUser } from "@/lib/authorization";

export async function GET(request: NextRequest) {
  await requireAuthenticatedUser();
  const destination = buildWebSearchUrl(
    request.nextUrl.searchParams.get("q") ?? "",
  );

  if (!destination) {
    const home = new URL("/", request.url);
    home.searchParams.set("search", "empty");
    return NextResponse.redirect(home);
  }

  return NextResponse.redirect(destination);
}
