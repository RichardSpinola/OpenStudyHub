import { NextRequest, NextResponse } from "next/server";
import { withV2DbAsync, currentUserV2 } from "@/lib/v2/runtime";
import {
  classroomCache,
  GoogleClassroomAdapter,
  syncClassroom,
} from "@/lib/v2/classroom";
import { getServerEnvironment } from "@/lib/env";

export async function POST(request: NextRequest) {
  const expected = new URL(getServerEnvironment().APP_URL).origin;
  if (request.headers.get("origin") !== expected)
    return NextResponse.json({ error: "Origem inválida." }, { status: 403 });
  const body = (await request.json().catch(() => null)) as {
    offeringId?: unknown;
  } | null;
  const offeringId = body?.offeringId;
  if (
    typeof offeringId !== "number" ||
    !Number.isSafeInteger(offeringId) ||
    offeringId <= 0
  )
    return NextResponse.json({ error: "Oferta inválida." }, { status: 400 });
  try {
    const result = await withV2DbAsync(async (db) => {
      const user = await currentUserV2(db);
      if (!user || user.mustChangePassword) return null;
      const outcome = await syncClassroom(
        db,
        user.id,
        offeringId,
        new GoogleClassroomAdapter(db),
        true,
      );
      return { outcome, ...classroomCache(db, user.id, offeringId) };
    });
    return result
      ? NextResponse.json(result, { headers: { "cache-control": "no-store" } })
      : NextResponse.json(
          { error: "Sessão normal necessária." },
          { status: 401 },
        );
  } catch {
    return NextResponse.json(
      { error: "Não foi possível sincronizar." },
      { status: 400 },
    );
  }
}
