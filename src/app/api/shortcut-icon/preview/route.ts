import { isSameOriginRequest } from "@/lib/request-security";
import { NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/authorization";
import { currentAdminV2, withV2DbAsync } from "@/lib/v2/runtime";
import { fetchShortcutIcon } from "@/lib/shortcut-icons";
export async function POST(request: Request) {
  // Next can expose its internal listener URL; compare the browser's Host too.
  const origin = request.headers.get("origin");
  let sameHost = false;
  try {
    const candidate = new URL(origin ?? "");
    const protocol =
      request.headers.get("x-forwarded-proto") ??
      new URL(request.url).protocol.slice(0, -1);
    sameHost =
      candidate.host === request.headers.get("host") &&
      candidate.protocol === protocol + ":";
  } catch {
    /* A missing or malformed origin is denied. */
  }
  if (!isSameOriginRequest(request) && !sameHost)
    return NextResponse.json({ error: "Origem inválida." }, { status: 403 });
  const user = await getCurrentSession();
  const admin =
    !user && process.env.OPENSTUDYHUB_V2_ENABLED === "1"
      ? await withV2DbAsync(currentAdminV2)
      : null;
  if (!user && (!admin || admin.mustChangePassword))
    return NextResponse.json({ error: "Entre novamente." }, { status: 401 });
  if (Number(request.headers.get("content-length") ?? 0) > 4096)
    return NextResponse.json({ error: "URL inválida." }, { status: 413 });
  const data = await request.text();
  if (data.length > 4096)
    return NextResponse.json({ error: "URL inválida." }, { status: 413 });
  try {
    const { url } = JSON.parse(data);
    if (typeof url !== "string" || url.length > 2048) throw new Error();
    const image = await fetchShortcutIcon(url);
    return NextResponse.json(
      {
        image: image
          ? "data:image/png;base64," + image.toString("base64")
          : null,
      },
      { headers: { "cache-control": "no-store" } },
    );
  } catch {
    return NextResponse.json(
      { error: "Informe uma URL válida." },
      { status: 400 },
    );
  }
}
