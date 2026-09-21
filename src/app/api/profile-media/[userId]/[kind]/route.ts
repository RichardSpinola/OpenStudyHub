import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { getCurrentSession } from "@/lib/authorization";
import { canViewUser } from "@/lib/collaboration";
import {
  profileMediaLimitBytes,
  readProfileMedia,
  removeProfileMedia,
  saveProfileMedia,
} from "@/lib/profile-media";
import { isSameOriginRequest } from "@/lib/request-security";

const id = z.coerce.number().int().positive();
const kindSchema = z.enum(["avatar", "banner"]);

async function parameters(context: {
  params: Promise<{ userId: string; kind: string }>;
}) {
  const params = await context.params;
  return {
    userId: id.parse(params.userId),
    kind: kindSchema.parse(params.kind),
  };
}

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ userId: string; kind: string }> },
) {
  const session = await getCurrentSession();
  if (!session) return new NextResponse(null, { status: 401 });
  try {
    const { userId, kind } = await parameters(context);
    if (!canViewUser(session.user.id, userId))
      return new NextResponse(null, { status: 403 });
    const image = await readProfileMedia(userId, kind);
    if (!image) return new NextResponse(null, { status: 404 });
    return new NextResponse(new Uint8Array(image.data), {
      headers: {
        "cache-control": "private, no-cache",
        "content-type": image.mimeType,
        "x-content-type-options": "nosniff",
      },
    });
  } catch {
    return new NextResponse(null, { status: 404 });
  }
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ userId: string; kind: string }> },
) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ error: "invalid-origin" }, { status: 403 });
  }
  const session = await getCurrentSession();
  if (!session)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try {
    const { userId, kind } = await parameters(context);
    if (userId !== session.user.id)
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    const form = await request.formData();
    const file = form.get("image");
    if (!(file instanceof File) || file.size > profileMediaLimitBytes)
      throw new Error("Invalid image.");
    await saveProfileMedia(userId, kind, Buffer.from(await file.arrayBuffer()));
    return new NextResponse(null, { status: 204 });
  } catch {
    return NextResponse.json({ error: "invalid-image" }, { status: 400 });
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ userId: string; kind: string }> },
) {
  if (!isSameOriginRequest(request))
    return new NextResponse(null, { status: 403 });
  const session = await getCurrentSession();
  if (!session) return new NextResponse(null, { status: 401 });
  const { userId, kind } = await parameters(context);
  if (userId !== session.user.id)
    return new NextResponse(null, { status: 403 });
  await removeProfileMedia(userId, kind);
  return new NextResponse(null, { status: 204 });
}
