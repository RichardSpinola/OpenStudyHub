import { NextRequest, NextResponse } from "next/server";

import { getCurrentSession } from "@/lib/authorization";
import {
  homeBackgroundLimitBytes,
  readHomeBackground,
  removeHomeBackground,
  saveHomeBackground,
} from "@/lib/home-background";
import { isSameOriginRequest } from "@/lib/request-security";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getCurrentSession();
  if (!session) return new NextResponse(null, { status: 401 });
  const asset = await readHomeBackground(session.user.id);
  if (!asset) return new NextResponse(null, { status: 404 });
  return new NextResponse(new Uint8Array(asset.data), {
    headers: {
      "cache-control": "private, no-cache",
      "content-type": asset.record.mimeType,
      "x-content-type-options": "nosniff",
    },
  });
}

export async function POST(request: NextRequest) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ error: "invalid-origin" }, { status: 403 });
  }
  const session = await getCurrentSession();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  try {
    const formData = await request.formData();
    const file = formData.get("background");
    if (!(file instanceof File) || file.size > homeBackgroundLimitBytes) {
      throw new Error("invalid-background");
    }
    const record = await saveHomeBackground(
      session.user.id,
      Buffer.from(await file.arrayBuffer()),
    );
    return NextResponse.json({ updatedAt: record.updatedAt });
  } catch {
    return NextResponse.json({ error: "invalid-background" }, { status: 400 });
  }
}

export async function DELETE(request: NextRequest) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ error: "invalid-origin" }, { status: 403 });
  }
  const session = await getCurrentSession();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  await removeHomeBackground(session.user.id);
  return new NextResponse(null, { status: 204 });
}
