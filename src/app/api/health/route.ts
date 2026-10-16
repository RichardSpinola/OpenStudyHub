import { NextResponse } from "next/server";
import { operationalHealth } from "@/lib/v2/operational-health";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export async function GET() {
  try {
    const health = await operationalHealth();
    const ready =
      health.database === "operational" &&
      health.canonical !== "unavailable" &&
      health.storage === "operational" &&
      !health.maintenance;
    return NextResponse.json(
      {
        status: ready
          ? health.realtime === "unavailable"
            ? "degraded"
            : "ok"
          : "unavailable",
        checks: {
          application: "operational",
          database: health.database,
          canonical: health.canonical,
          storage: health.storage,
          realtime: health.realtime,
          maintenance: health.maintenance,
        },
      },
      { status: ready ? 200 : 503, headers: { "cache-control": "no-store" } },
    );
  } catch {
    return NextResponse.json(
      { status: "unavailable" },
      { status: 503, headers: { "cache-control": "no-store" } },
    );
  }
}
