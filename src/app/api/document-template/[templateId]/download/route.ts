import { NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/authorization";
import { assertToolAvailable } from "@/lib/v2/exam-access";
import { downloadOwnedTemplateSource } from "@/lib/template-source-access";
export const runtime = "nodejs";
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ templateId: string }> },
) {
  const session = await getCurrentSession();
  if (!session) return new NextResponse(null, { status: 401 });
  try {
    assertToolAvailable(session.user.id);
  } catch {
    return new NextResponse(null, { status: 403 });
  }
  const id = Number((await params).templateId);
  if (!Number.isSafeInteger(id) || id < 1)
    return new NextResponse(null, { status: 404 });
  try {
    const { bytes, name } = await downloadOwnedTemplateSource(
      session.user.id,
      id,
    );
    return new NextResponse(new Uint8Array(bytes), {
      headers: {
        "content-type": "application/pdf",
        "content-disposition": `inline; filename*=UTF-8''${encodeURIComponent(name.replaceAll(/[\r\n"\\]/g, "_") + ".pdf")}`,
        "cache-control": "private, no-store",
        "x-content-type-options": "nosniff",
        "content-security-policy": "default-src 'none'; sandbox",
      },
    });
  } catch {
    return new NextResponse(null, { status: 404 });
  }
}
