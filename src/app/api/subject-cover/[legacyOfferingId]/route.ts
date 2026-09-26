import { NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/authorization";
import { listUserSubjectOfferings } from "@/lib/academic";
import { withV2DbAsync } from "@/lib/v2/runtime";
import {
  coverForLegacyOffering,
  readOfferingCover,
} from "@/lib/v2/offering-covers";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ legacyOfferingId: string }> },
) {
  if (process.env.OPENSTUDYHUB_V2_ENABLED !== "1")
    return new Response(null, { status: 404 });
  const id = Number((await params).legacyOfferingId);
  if (!Number.isSafeInteger(id) || id < 1)
    return new Response(null, { status: 404 });
  const session = await getCurrentSession();
  if (!session) return new Response(null, { status: 401 });
  if (
    !listUserSubjectOfferings(session.user.id).some(
      (offering) => offering.offeringId === id,
    )
  )
    return new Response(null, { status: 404 });
  const cover = await withV2DbAsync(async (db) =>
    coverForLegacyOffering(db, id),
  );
  if (!cover) return new Response(null, { status: 404 });
  const image = await readOfferingCover(cover);
  if (!image) return new Response(null, { status: 404 });
  return new NextResponse(new Uint8Array(image.data), {
    headers: {
      "content-type": image.mimeType,
      "cache-control": "private, no-cache",
      "x-content-type-options": "nosniff",
    },
  });
}
