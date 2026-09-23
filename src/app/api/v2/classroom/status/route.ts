import { after, NextRequest, NextResponse } from "next/server";
import { withV2DbAsync, currentUserV2 } from "@/lib/v2/runtime";
import {
  classroomCache,
  eligibleOfferings,
  GoogleClassroomAdapter,
  syncClassroom,
} from "@/lib/v2/classroom";
import { getServerEnvironment } from "@/lib/env";
import { fakeClassroomAdapter, fakeGoogleEnabled } from "@/lib/v2/fake-google";

export async function GET(request: NextRequest) {
  const offeringId = Number(request.nextUrl.searchParams.get("offeringId"));
  if (!Number.isSafeInteger(offeringId) || offeringId <= 0)
    return NextResponse.json({ error: "Oferta inválida." }, { status: 400 });
  const result = await withV2DbAsync(async (db) => {
    const user = await currentUserV2(db);
    if (!user || user.mustChangePassword) return null;
    if (
      !eligibleOfferings(db, user.id).some(
        (row) => row.offeringId === offeringId,
      )
    )
      return null;
    const mapping = db
      .prepare(
        "SELECT 1 FROM user_classroom_mappings WHERE user_id=? AND offering_id=?",
      )
      .get(user.id, offeringId);
    if (!mapping) return null;
    return { userId: user.id, cache: classroomCache(db, user.id, offeringId) };
  });
  if (!result)
    return NextResponse.json({ error: "Sem acesso." }, { status: 403 });
  const ttl = getServerEnvironment().CLASSROOM_SYNC_TTL_MINUTES * 60_000;
  const stale =
    !result.cache.state.success ||
    Date.now() - result.cache.state.success >= ttl;
  if (stale && result.cache.state.status !== "needs_reconnect") {
    after(async () => {
      try {
        await withV2DbAsync(async (db) =>
          syncClassroom(
            db,
            result.userId,
            offeringId,
            fakeGoogleEnabled()
              ? fakeClassroomAdapter(db, result.userId)
              : new GoogleClassroomAdapter(db),
            false,
            Date.now(),
            ttl,
          ),
        );
      } catch {
        /* Status remains in the DB for the next request. */
      }
    });
  }
  return NextResponse.json(result.cache, {
    headers: { "cache-control": "no-store" },
  });
}
