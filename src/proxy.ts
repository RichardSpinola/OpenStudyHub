import { backupMaintenanceActive } from "@/lib/v2/maintenance";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { withV2Db, USER_COOKIE } from "@/lib/v2/runtime-database";
import { sessionUserV2 } from "@/lib/v2/auth";
import { activeExam, examRestrictedPath } from "@/lib/v2/academic-events";
import { configuredSurface, surfaceRoute } from "@/lib/v2/surface";

export function proxy(request: NextRequest) {
  if (
    backupMaintenanceActive() &&
    !/^\/(api\/health|_next\/|brand\/)/.test(request.nextUrl.pathname)
  )
    return new Response(
      "Cópia de segurança em andamento. Aguarde e tente novamente; suas alterações não foram enviadas.",
      {
        status: 503,
        headers: {
          "retry-after": "10",
          "cache-control": "no-store",
          "content-type": "text/plain; charset=utf-8",
        },
      },
    );
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
  if (surface !== "admin" && process.env.OPENSTUDYHUB_V2_ENABLED === "1") {
    const path = request.nextUrl.pathname;
    const resource =
      examRestrictedPath(path) ||
      (/^\/subjects\/\d+$/.test(path) &&
        ["notes", "documents", "projects"].includes(
          request.nextUrl.searchParams.get("view") ?? "",
        ));
    if (resource) {
      const token = request.cookies.get(USER_COOKIE)?.value;
      const exam = token
        ? withV2Db((db) => {
            const user = sessionUserV2(db, token);
            return user ? activeExam(db, user.id) : null;
          })
        : null;
      if (exam) {
        if (path.startsWith("/api/") || request.method !== "GET")
          return NextResponse.json(
            { error: "Recurso indisponível durante o modo de prova." },
            { status: 403, headers: { "cache-control": "no-store" } },
          );
        return NextResponse.redirect(
          new URL("/today?restriction=exam", request.url),
        );
      }
    }
  }
  const headers = new Headers(request.headers);
  headers.set("x-openstudyhub-surface", route);
  return NextResponse.next({ request: { headers } });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|brand/).*)"],
};
