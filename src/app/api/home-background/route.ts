import { NextRequest, NextResponse } from "next/server";

import { getCurrentSession } from "@/lib/authorization";
import {
  homeBackgroundLimitBytes,
  readHomeBackground,
  removeHomeBackground,
  saveHomeBackground,
} from "@/lib/home-background";
import { isSameOriginRequest } from "@/lib/request-security";
import {
  chooseWallpaper,
  readWallpaper,
  removeWallpaper,
  wallpaperPresets,
  v2WallpaperLimitBytes,
} from "@/lib/home-wallpapers";
import { uploadWallpaper } from "@/lib/home-wallpapers";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const session = await getCurrentSession();
  if (!session) return new NextResponse(null, { status: 401 });
  const wallpaperId = request.nextUrl.searchParams.get("wallpaperId");
  if (wallpaperId !== null && process.env.OPENSTUDYHUB_V2_ENABLED === "1") {
    const id = Number(wallpaperId);
    if (!Number.isSafeInteger(id) || id < 1)
      return new NextResponse(null, { status: 404 });
    const wallpaper = await readWallpaper(session.user.id, id);
    if (!wallpaper) return new NextResponse(null, { status: 404 });
    return new NextResponse(new Uint8Array(wallpaper.data), {
      headers: {
        "cache-control": "private, no-cache",
        "content-type": wallpaper.mimeType,
        "x-content-type-options": "nosniff",
      },
    });
  }
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
    if (process.env.OPENSTUDYHUB_V2_ENABLED === "1") {
      const choice = formData.get("choice");
      if (typeof choice === "string") {
        if (wallpaperPresets.some((preset) => preset === choice)) {
          chooseWallpaper(
            session.user.id,
            choice as (typeof wallpaperPresets)[number],
          );
        } else if (/^custom:[1-9]\d*$/.test(choice)) {
          chooseWallpaper(session.user.id, Number(choice.slice(7)));
        } else {
          throw new Error("invalid-choice");
        }
        return NextResponse.json({ ok: true });
      }
      const file = formData.get("background");
      if (!(file instanceof File) || file.size > v2WallpaperLimitBytes)
        throw new Error("invalid-background");
      await uploadWallpaper(
        session.user.id,
        Buffer.from(await file.arrayBuffer()),
      );
      return NextResponse.json({ ok: true });
    }
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
  if (process.env.OPENSTUDYHUB_V2_ENABLED === "1") {
    const value = request.nextUrl.searchParams.get("wallpaperId");
    if (value === "legacy") {
      await removeHomeBackground(session.user.id);
      chooseWallpaper(session.user.id, "none");
      return new NextResponse(null, { status: 204 });
    }
    const id = Number(value);
    if (value === null || !Number.isSafeInteger(id) || id < 1)
      return NextResponse.json({ error: "invalid-wallpaper" }, { status: 400 });
    try {
      await removeWallpaper(session.user.id, id);
    } catch {
      return NextResponse.json({ error: "invalid-wallpaper" }, { status: 400 });
    }
  } else {
    await removeHomeBackground(session.user.id);
  }
  return new NextResponse(null, { status: 204 });
}
