import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { getCurrentSession } from "@/lib/authorization";
import {
  chatAttachmentLimitBytes,
  saveChatAttachment,
} from "@/lib/chat-attachments";
import { isSameOriginRequest } from "@/lib/request-security";

const id = z.coerce.number().int().positive();

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ roomId: string }> },
) {
  if (!isSameOriginRequest(request))
    return new NextResponse(null, { status: 403 });
  const session = await getCurrentSession();
  if (!session) return new NextResponse(null, { status: 401 });
  try {
    const form = await request.formData();
    const image = form.get("image");
    if (!(image instanceof File) || image.size > chatAttachmentLimitBytes)
      throw new Error("Invalid image.");
    const attachmentId = await saveChatAttachment(
      session.user.id,
      id.parse((await context.params).roomId),
      id.parse(form.get("messageId")),
      Buffer.from(await image.arrayBuffer()),
    );
    return NextResponse.json({ attachmentId });
  } catch {
    return NextResponse.json({ error: "invalid-attachment" }, { status: 400 });
  }
}
