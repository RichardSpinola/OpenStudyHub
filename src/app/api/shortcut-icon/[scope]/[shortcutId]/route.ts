import { NextResponse } from "next/server";
import { z } from "zod";

import { getCurrentSession } from "@/lib/authorization";
import { readShortcutIcon } from "@/lib/shortcut-icons";

const id = z.coerce.number().int().positive();
const scopeSchema = z.enum(["instance", "user"]);

export async function GET(
  _request: Request,
  context: { params: Promise<{ scope: string; shortcutId: string }> },
) {
  const session = await getCurrentSession();
  if (!session) return new NextResponse(null, { status: 401 });
  try {
    const params = await context.params;
    const icon = await readShortcutIcon(
      scopeSchema.parse(params.scope),
      id.parse(params.shortcutId),
      session.user.id,
    );
    if (!icon) return new NextResponse(null, { status: 404 });
    return new NextResponse(new Uint8Array(icon.data), {
      headers: {
        "cache-control": "private, max-age=3600",
        "content-type": icon.mimeType,
        "x-content-type-options": "nosniff",
      },
    });
  } catch {
    return new NextResponse(null, { status: 404 });
  }
}
