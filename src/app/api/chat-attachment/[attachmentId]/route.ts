import { NextResponse } from "next/server";
import { z } from "zod";

import { getCurrentSession } from "@/lib/authorization";
import { assertToolAvailable } from "@/lib/v2/exam-access";
import { readChatAttachment } from "@/lib/chat-attachments";

export async function GET(
  _request: Request,
  context: { params: Promise<{ attachmentId: string }> },
) {
  const session = await getCurrentSession();
  if (!session) return new NextResponse(null, { status: 401 });
  try {
    assertToolAvailable(session.user.id);
    const image = await readChatAttachment(
      session.user.id,
      z.coerce
        .number()
        .int()
        .positive()
        .parse((await context.params).attachmentId),
    );
    if (!image) return new NextResponse(null, { status: 404 });
    return new NextResponse(new Uint8Array(image.data), {
      headers: {
        "cache-control": "private, no-store",
        "content-disposition": `${image.mimeType.startsWith("image/") ? "inline" : "attachment"}; filename*=UTF-8''${encodeURIComponent(image.name).replace(/['()*]/g, (c) => `%${c.charCodeAt(0).toString(16)}`)}`,
        "content-type": image.mimeType,
        "x-content-type-options": "nosniff",
      },
    });
  } catch {
    return new NextResponse(null, { status: 404 });
  }
}
