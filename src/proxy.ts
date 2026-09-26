import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { configuredSurface, surfaceRoute } from "@/lib/v2/surface";

export function proxy(request: NextRequest) {
  const surface = configuredSurface(
    process.env.OPENSTUDYHUB_SURFACE,
    process.env.NODE_ENV === "production",
  );
  const route = surfaceRoute(surface, request.nextUrl.pathname);
  if (route === "blocked")
    return new Response("Not Found", {
      status: 404,
      headers: { "cache-control": "no-store" },
    });
  if (route === "admin-home")
    return NextResponse.redirect(new URL("/control", request.url));
  const headers = new Headers(request.headers);
  headers.set("x-openstudyhub-surface", route);
  return NextResponse.next({ request: { headers } });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|brand/).*)"],
};
