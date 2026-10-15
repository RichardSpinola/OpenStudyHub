import { getCurrentSession } from "@/lib/authorization";
import { readNoteImage } from "@/lib/note-images";
import { noteImageId } from "@/lib/note-image-url";
import { assertToolAvailable } from "@/lib/v2/exam-access";
export const dynamic = "force-dynamic";
export async function GET(
  _request: Request,
  context: { params: Promise<{ imageId: string }> },
) {
  const session = await getCurrentSession();
  if (!session) return new Response(null, { status: 401 });
  try {
    assertToolAvailable(session.user.id);
  } catch {
    return new Response(null, { status: 403 });
  }
  const { imageId } = await context.params;
  if (!noteImageId(`/api/note-images/${imageId}`))
    return new Response(null, { status: 404 });
  const image = readNoteImage(session.user.id, imageId);
  if (!image) return new Response(null, { status: 404 });
  return new Response(new Uint8Array(image.data), {
    headers: {
      "content-type": image.mimeType,
      "cache-control": "private, no-store",
      "x-content-type-options": "nosniff",
      "content-security-policy": "default-src 'none'; sandbox",
    },
  });
}
