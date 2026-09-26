import { NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/authorization";
import { readChatWallpaperImage } from "@/lib/v2/chat-state";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getCurrentSession();
  if (!session) return new NextResponse(null, { status: 401 });
  const wallpaper = readChatWallpaperImage(session.user.id);
  if (!wallpaper) return new NextResponse(null, { status: 404 });
  return new NextResponse(new Uint8Array(wallpaper.image), { headers: {
    "cache-control": "private, no-cache",
    "content-type": wallpaper.mimeType,
    "x-content-type-options": "nosniff",
  }});
}
