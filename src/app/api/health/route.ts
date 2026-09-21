import { NextResponse } from "next/server";

import { checkDatabaseConnection } from "@/lib/db/client";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export function GET() {
  try {
    if (!checkDatabaseConnection()) {
      throw new Error("Database check failed");
    }

    return NextResponse.json({
      status: "ok",
      checks: {
        application: "operational",
        database: "operational",
      },
    });
  } catch {
    return NextResponse.json(
      {
        status: "unavailable",
        checks: {
          application: "operational",
          database: "unavailable",
        },
      },
      { status: 503 },
    );
  }
}
