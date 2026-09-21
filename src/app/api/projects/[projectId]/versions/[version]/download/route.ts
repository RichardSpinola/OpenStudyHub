import { NextResponse } from "next/server";

import { getCurrentSession } from "@/lib/authorization";
import { downloadDriveFile } from "@/lib/google/drive";
import { getProjectVersion, getUserProject } from "@/lib/projects";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ projectId: string; version: string }> },
) {
  const session = await getCurrentSession();
  if (!session) return new NextResponse(null, { status: 401 });
  const values = await params;
  if (!/^\d+$/.test(values.projectId) || !/^\d+$/.test(values.version)) {
    return new NextResponse(null, { status: 404 });
  }
  try {
    const project = getUserProject(session.user.id, Number(values.projectId));
    const version = getProjectVersion(
      session.user.id,
      project.id,
      Number(values.version),
    );
    const archive = await downloadDriveFile(
      session.user.id,
      version.archiveDriveFileId,
    );
    const safeName = project.name.replace(/[^a-zA-Z0-9._-]+/g, "-");
    return new NextResponse(archive as unknown as BodyInit, {
      headers: {
        "content-type": "application/zip",
        "content-disposition": `attachment; filename="${safeName}-v${String(version.versionNumber).padStart(4, "0")}.zip"`,
        "cache-control": "private, no-store",
        "x-content-type-options": "nosniff",
      },
    });
  } catch {
    return new NextResponse(null, { status: 404 });
  }
}
