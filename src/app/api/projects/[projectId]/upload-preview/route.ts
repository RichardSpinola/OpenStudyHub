import { NextResponse } from "next/server";
import { mkdir, mkdtemp, realpath, rm } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { readBoundedFormData } from "@/lib/chat-upload";
import {
  withProjectTransfer,
  ProjectTransferBusy,
  spoolProjectBody,
} from "@/lib/project-transfer";
import { backupMaintenanceActive } from "@/lib/v2/maintenance";
import { configuredSurface } from "@/lib/v2/surface";
import { examForLegacyUser } from "@/lib/v2/exam-access";

import { getCurrentSession } from "@/lib/authorization";
import { readProjectZip } from "@/lib/project-archive";
import {
  projectUploadLimits,
  suggestProjectLanguage,
  suggestProjectTechnologies,
  type ProjectSourceFile,
} from "@/lib/project-manifest";
import {
  getUserProject,
  prepareProjectUpload,
  ProjectConflictError,
} from "@/lib/projects";
import { isSameOriginRequest } from "@/lib/request-security";

export const runtime = "nodejs";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ projectId: string }> },
) {
  // This route bypasses the buffering proxy. Keep its surface, maintenance and
  // exam guards here before consuming any upload bytes.
  if (
    configuredSurface(
      process.env.OPENSTUDYHUB_SURFACE,
      process.env.NODE_ENV === "production",
    ) === "admin"
  )
    return new NextResponse(null, { status: 404 });
  if (backupMaintenanceActive())
    return new NextResponse(
      "Cópia de segurança em andamento. Tente novamente.",
      { status: 503, headers: { "retry-after": "10" } },
    );
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
  if (examForLegacyUser(session.user.id))
    return NextResponse.json(
      { error: "Recurso indisponível durante o modo de prova." },
      { status: 403 },
    );
  const rawProjectId = (await params).projectId;
  if (!/^\d+$/.test(rawProjectId)) {
    return NextResponse.json({ error: "invalid-project" }, { status: 400 });
  }
  try {
    const project = getUserProject(session.user.id, Number(rawProjectId));
    if (project.ownerUserId !== session.user.id)
      return NextResponse.json(
        { error: "Este projeto foi compartilhado somente para leitura." },
        { status: 403 },
      );
    return await withProjectTransfer(async () => {
      const rawZip =
        request.headers.get("content-type")?.split(";")[0] ===
        "application/zip";
      const formData = rawZip
        ? new FormData()
        : await readBoundedFormData(
            request,
            projectUploadLimits.maxArchiveBytes + 1024 * 1024,
          );
      if (rawZip)
        formData.set(
          "baseVersionNumber",
          new URL(request.url).searchParams.get("baseVersionNumber") ?? "",
        );
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
      if (rawZip) {
        // Large input belongs on the data volume; /tmp may be RAM-backed.
        const incoming = resolve(
          dirname(
            process.env.OPENSTUDYHUB_V2_DATABASE_PATH ??
              process.env.DATABASE_PATH ??
              "./data/app.db",
          ),
          "project-incoming",
        );
        await mkdir(incoming, { recursive: true, mode: 0o700 });
        if ((await realpath(incoming)) !== incoming)
          throw new Error("Invalid upload directory.");
        const temporary = await mkdtemp(join(incoming, "upload-"));
        try {
          const path = join(temporary, "upload.zip");
          await spoolProjectBody(
            request,
            path,
            projectUploadLimits.maxArchiveBytes,
          );
          sources = await readProjectZip(path);
        } finally {
          await rm(temporary, { recursive: true, force: true });
        }
      } else if (zip instanceof File && zip.size > 0) {
        if (zip.size > projectUploadLimits.maxArchiveBytes) {
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
        suggestedTechnologies: suggestProjectTechnologies(
          preview.manifest.files,
        ),
      });
    });
  } catch (error) {
    if (error instanceof ProjectTransferBusy)
      return NextResponse.json(
        { error: error.message },
        { status: 429, headers: { "retry-after": "5" } },
      );
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
