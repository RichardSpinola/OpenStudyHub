import { NextResponse } from "next/server";
import { currentAdminV2, currentUserV2, withV2DbAsync } from "@/lib/v2/runtime";
import { canManage } from "@/lib/v2/access";
import { coverForOffering, readOfferingCover } from "@/lib/v2/offering-covers";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ offeringId: string }> },
) {
  const id = Number((await params).offeringId);
  if (!Number.isSafeInteger(id) || id < 1)
    return new Response(null, { status: 404 });
  const cover = await withV2DbAsync(async (db) => {
    const admin = await currentAdminV2(db);
    const actor = admin ?? (await currentUserV2(db));
    if (!actor) return null;
    if (
      !admin &&
      !canManage(db, actor, "manage_academics", { kind: "offering", id })
    )
      return null;
    return coverForOffering(db, id);
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
