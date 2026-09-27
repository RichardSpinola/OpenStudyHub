import { NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/authorization";
import { withV2DbAsync } from "@/lib/v2/runtime";
import { coverForOffering, readOfferingCover } from "@/lib/v2/offering-covers";
import { canonicalIdForLegacy } from "@/lib/v2/identity-bridge";
import { listV2UserOfferings } from "@/lib/v2/academic-read";

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
  const cover = await withV2DbAsync(async (db) => {
    const canonicalId = canonicalIdForLegacy(db, session.user.id);
    if (
      !canonicalId ||
      !listV2UserOfferings(db, canonicalId).some(
        (offering) => offering.offeringId === id,
      )
    )
      return null;
    return coverForOffering(db, id) ?? null;
  });
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
