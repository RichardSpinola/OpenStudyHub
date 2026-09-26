import { NextResponse } from "next/server";

import { getCurrentSession } from "@/lib/authorization";
import { downloadDriveFile } from "@/lib/google/drive";
import { listProjectFiles } from "@/lib/projects";
import {
  canPreviewProjectPath,
  decodeProjectText,
  maxProjectPreviewBytes,
} from "@/lib/project-preview";

export const runtime = "nodejs";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ projectId: string }> },
) {
  const session = await getCurrentSession();
  if (!session) return NextResponse.json({ error: "auth" }, { status: 401 });
  const rawId = (await params).projectId;
  if (!/^\d+$/u.test(rawId))
    return NextResponse.json({ error: "not-found" }, { status: 404 });
  const path = new URL(request.url).searchParams.get("path");
  if (!path) return NextResponse.json({ error: "not-found" }, { status: 404 });
  try {
    const file = listProjectFiles(session.user.id, Number(rawId)).find(
      (item) => item.path === path,
    );
    if (!file)
      return NextResponse.json({ error: "not-found" }, { status: 404 });
    if (file.sizeBytes > maxProjectPreviewBytes) {
      return NextResponse.json(
        { kind: "too-large" },
        { headers: { "cache-control": "private, no-store" } },
      );
    }
    if (!canPreviewProjectPath(file.path)) {
      return NextResponse.json(
        { kind: "binary" },
        { headers: { "cache-control": "private, no-store" } },
      );
    }
    const bytes = await downloadDriveFile(session.user.id, file.driveFileId, {
      maxBytes: maxProjectPreviewBytes,
    });
    if (bytes.length > maxProjectPreviewBytes) {
      return NextResponse.json(
        { kind: "too-large" },
        { headers: { "cache-control": "private, no-store" } },
      );
    }
    const text = decodeProjectText(bytes);
    return NextResponse.json(
      text === null ? { kind: "binary" } : { kind: "text", text },
      {
        headers: {
          "cache-control": "private, no-store",
          "x-content-type-options": "nosniff",
        },
      },
    );
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === "Drive file exceeds preview limit."
    ) {
      return NextResponse.json(
        { kind: "too-large" },
        { headers: { "cache-control": "private, no-store" } },
      );
    }
    return NextResponse.json(
      { error: "preview-unavailable" },
      { status: 503, headers: { "cache-control": "private, no-store" } },
    );
  }
}
