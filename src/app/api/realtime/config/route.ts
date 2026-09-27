import { NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/authorization";

export async function GET() {
  if (
    process.env.OPENSTUDYHUB_V2_ENABLED !== "1" ||
    !(await getCurrentSession())
  )
    return NextResponse.json({ enabled: false }, { status: 401 });
  const app = new URL(process.env.APP_URL ?? "http://127.0.0.1:3044");
  const fallback =
    app.hostname === "localhost" || app.hostname === "127.0.0.1"
      ? `${app.protocol === "https:" ? "wss" : "ws"}://${app.hostname}:${process.env.REALTIME_PORT || "3045"}/realtime`
      : `${app.protocol === "https:" ? "wss" : "ws"}://${app.host}/realtime`;
  const url = new URL(process.env.REALTIME_PUBLIC_URL || fallback);
  if (
    !["ws:", "wss:"].includes(url.protocol) ||
    (app.protocol === "https:" && url.protocol !== "wss:")
  )
    return NextResponse.json({ enabled: false });
  return NextResponse.json(
    { enabled: true, url: url.toString() },
    { headers: { "cache-control": "no-store" } },
  );
}
