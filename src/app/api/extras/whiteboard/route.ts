import { assertToolAvailable } from "@/lib/v2/exam-access";
import { NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/authorization";
import { extraAccessible, getExtrasFlags } from "@/lib/v2/extras";
import { withV2Db } from "@/lib/v2/runtime";
import { readGlobalWhiteboard } from "@/lib/v2/whiteboard";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getCurrentSession();
  if (!session)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try {
    assertToolAvailable(session.user.id);
  } catch {
    return NextResponse.json({ error: "Modo de prova." }, { status: 403 });
  }
  if (process.env.OPENSTUDYHUB_V2_ENABLED !== "1")
    return NextResponse.json({ error: "unavailable" }, { status: 404 });
  return withV2Db((db) => {
    if (!extraAccessible(getExtrasFlags(db), "whiteboard"))
      return NextResponse.json({ error: "unavailable" }, { status: 404 });
    return NextResponse.json(
      { elements: readGlobalWhiteboard(db) },
      { headers: { "cache-control": "private, no-store" } },
    );
  });
}
