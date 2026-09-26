import { NextResponse } from "next/server";

import { getCurrentSession } from "@/lib/authorization";
import { readProjectZip } from "@/lib/project-archive";
import {
  projectUploadLimits,
  suggestProjectLanguage,
  suggestProjectTechnologies,
  type ProjectSourceFile,
} from "@/lib/project-manifest";
import { prepareProjectUpload, ProjectConflictError } from "@/lib/projects";
import { isSameOriginRequest } from "@/lib/request-security";

export const runtime = "nodejs";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ projectId: string }> },
) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ error: "invalid-origin" }, { status: 403 });
  }
  const session = await getCurrentSession();
  if (!session) {
    return NextResponse.json(
      { error: "authentication-required" },
      { status: 401 },
    );
  }
  const rawProjectId = (await params).projectId;
  if (!/^\d+$/.test(rawProjectId)) {
    return NextResponse.json({ error: "invalid-project" }, { status: 400 });
  }
  try {
    const formData = await request.formData();
    const baseValue = formData.get("baseVersionNumber");
    const baseVersionNumber =
      typeof baseValue === "string" && /^\d+$/.test(baseValue)
        ? Number(baseValue)
        : null;
    const zip = formData.get("zipFile");
    const folderFiles = formData
      .getAll("folderFiles")
      .filter((entry): entry is File => entry instanceof File);
    const folderPaths = formData
      .getAll("folderPaths")
      .filter((entry): entry is string => typeof entry === "string");
    let sources: ProjectSourceFile[];
    if (zip instanceof File && zip.size > 0) {
      if (zip.size > projectUploadLimits.maxTotalBytes) {
        throw new Error("upload-limit");
      }
      sources = await readProjectZip(Buffer.from(await zip.arrayBuffer()));
    } else if (folderFiles.length > 0) {
      if (folderFiles.length > projectUploadLimits.maxFiles) {
        throw new Error("upload-limit");
      }
      let total = 0;
      sources = [];
      for (const [index, file] of folderFiles.entries()) {
        total += file.size;
        if (
          file.size > projectUploadLimits.maxFileBytes ||
          total > projectUploadLimits.maxTotalBytes
        ) {
          throw new Error("upload-limit");
        }
        sources.push({
          path: folderPaths[index] ?? file.name,
          data: Buffer.from(await file.arrayBuffer()),
          mimeType: file.type || null,
        });
      }
    } else {
      return NextResponse.json({ error: "files-required" }, { status: 400 });
    }
    const preview = await prepareProjectUpload(
      session.user.id,
      Number(rawProjectId),
      { files: sources, baseVersionNumber },
    );
    return NextResponse.json({
      token: preview.token,
      expiresAt: preview.expiresAt,
      ignored: preview.ignored,
      diff: preview.diff,
      files: preview.manifest.files.length,
      suggestedLanguage: suggestProjectLanguage(preview.manifest.files),
      suggestedTechnologies: suggestProjectTechnologies(preview.manifest.files),
    });
  } catch (error) {
    if (error instanceof ProjectConflictError) {
      return NextResponse.json({ error: "version-conflict" }, { status: 409 });
    }
    if (
      error instanceof Error &&
      /^(Caminho |Arquivo acima |Projeto acima |ZIP |Project exceeds|Project has no accepted files)/u.test(
        error.message,
      )
    ) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ error: "invalid-upload" }, { status: 400 });
  }
}
