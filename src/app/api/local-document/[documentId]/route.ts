import { NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/authorization";
import { getLocalDocument } from "@/lib/v2/local-documents";

export async function GET(_request: Request, context: { params: Promise<{ documentId: string }> }) {
  const session = await getCurrentSession();
  if (!session) return new NextResponse(null, { status: 401 });
  const id = Number((await context.params).documentId);
  if (!Number.isSafeInteger(id) || id < 1) return new NextResponse(null, { status: 404 });
  const document = getLocalDocument(session.user.id, id);
  if (!document) return new NextResponse(null, { status: 404 });
  const safeName = document.name.replaceAll(/[\r\n"\\]/g, "_");
  return new NextResponse(new Uint8Array(document.content), {
    headers: {
      "content-type": document.mimeType,
      "content-disposition": `attachment; filename*=UTF-8''${encodeURIComponent(safeName)}`,
      "content-security-policy": "default-src 'none'; sandbox",
      "cache-control": "private, no-store",
      "x-content-type-options": "nosniff",
    },
  });
}
