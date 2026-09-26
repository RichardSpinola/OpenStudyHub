import { NextRequest, NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/authorization";
import { canViewUser } from "@/lib/collaboration";
import { withV2Db } from "@/lib/v2/runtime";

export async function GET(request: NextRequest) {
  const session = await getCurrentSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const ids = [...new Set((request.nextUrl.searchParams.get("ids") || "").split(",")
    .map(Number).filter((id) => Number.isSafeInteger(id) && id > 0))].slice(0, 50);
  const allowed = ids.filter((id) => canViewUser(session.user.id, id));
  const online = withV2Db((db) => {
    const query = db.prepare(
      `SELECT EXISTS(SELECT 1 FROM realtime_connections c JOIN legacy_user_links l ON l.user_id=c.user_id
       WHERE l.legacy_user_id=? AND c.last_heartbeat_at>=?) online`,
    );
    return allowed.map((id) => ({ id, online: Boolean((query.get(id, Date.now() - 45_000) as { online: number }).online) }));
  });
  return NextResponse.json({ users: online }, { headers: { "cache-control": "no-store" } });
}
