"use server";

import { subjectResourceHref } from "@/lib/v2/academic-links";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { requireToolUser } from "@/lib/authorization";
import { listUserSubjectOfferings } from "@/lib/academic";
import {
  archiveUserProject,
  cancelProjectUploadPreview,
  confirmProjectUpload,
  createProject,
  getUserProject,
  updateProjectTechnology,
  ProjectConflictError,
} from "@/lib/projects";
import { setProjectShare } from "@/lib/v2/project-sharing";
import { withV2Db } from "@/lib/v2/runtime-database";
import { listVisibleUsers } from "@/lib/collaboration";
import { getDatabase } from "@/lib/db/client";
import {
  projectLanguageSchema,
  projectTechnologySchema,
} from "@/lib/project-manifest";

const idSchema = z.coerce.number().int().positive();

export async function createProjectAction(formData: FormData) {
  const user = await requireToolUser();
  const requestedOfferingId = formData.get("offeringId")
    ? Number(formData.get("offeringId"))
    : null;
  const offering = listUserSubjectOfferings(user.id).find(
    (item) => item.offeringId === requestedOfferingId,
  );
  const fromProjects = formData.get("from") === "projects";
  if (requestedOfferingId !== null && !offering)
    redirect("/projects/new?error=invalid-offering");
  try {
    const project = createProject(user.id, {
      offeringId: offering?.offeringId ?? null,
      name: String(formData.get("name") ?? ""),
      language: "other",
      ignorePreset: "other",
      technologies: [],
      description: String(formData.get("description") ?? "").trim() || null,
    });
    redirect(
      `/projects/${project.id}?status=${formData.get("start") === "empty" ? "empty" : "created"}${fromProjects ? "&from=projects" : ""}`,
    );
  } catch (error) {
    if (error && typeof error === "object" && "digest" in error) throw error;
    redirect(
      `/projects/new?offeringId=${offering?.offeringId ?? ""}&error=create-failed${fromProjects ? "&from=projects" : ""}`,
    );
  }
}

export async function updateProjectTechnologyAction(formData: FormData) {
  const user = await requireToolUser();
  const projectId = idSchema.parse(formData.get("projectId"));
  try {
    updateProjectTechnology(user.id, projectId, {
      language: projectLanguageSchema.parse(formData.get("language")),
      technologies: formData
        .getAll("technologies")
        .map((value) => projectTechnologySchema.parse(value)),
    });
    revalidatePath(`/projects/${projectId}`);
    revalidatePath("/projects");
    redirect(`/projects/${projectId}?status=technology-saved`);
  } catch (error) {
    if (error && typeof error === "object" && "digest" in error) throw error;
    redirect(`/projects/${projectId}?status=technology-error`);
  }
}

export async function archiveProjectAction(formData: FormData) {
  const user = await requireToolUser();
  const projectId = idSchema.parse(formData.get("projectId"));
  const project = getUserProject(user.id, projectId);
  archiveUserProject(user.id, project.id);
  revalidatePath("/subjects");
  redirect(
    project.subjectId === null
      ? "/library?type=projects&status=archived"
      : subjectResourceHref(
          user.id,
          project.offeringId,
          project.subjectId,
          "projects",
        ) + "&status=archived",
  );
}

export async function confirmProjectUploadAction(formData: FormData) {
  const user = await requireToolUser();
  const projectId = idSchema.parse(formData.get("projectId"));
  const token = String(formData.get("token") ?? "");
  const connection = getDatabase();
  getUserProject(user.id, projectId, connection);
  connection.sqlite
    .prepare(
      `INSERT INTO app_settings(key,value,updated_at) VALUES(?,?,?)
     ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=excluded.updated_at`,
    )
    .run(
      `project.sync_error.${projectId}`,
      "validação da prévia e leitura do ZIP temporário",
      Date.now(),
    );
  try {
    await confirmProjectUpload(
      user.id,
      token,
      String(formData.get("message") ?? ""),
      {
        language:
          projectLanguageSchema.safeParse(formData.get("language")).data ??
          getUserProject(user.id, projectId).language,
        technologies: formData.has("technologySelection")
          ? formData
              .getAll("technologies")
              .map((value) => projectTechnologySchema.parse(value))
          : undefined,
      },
    );
    revalidatePath(`/projects/${projectId}`);
    revalidatePath("/subjects");
    redirect(`/projects/${projectId}?status=synced`);
  } catch (error) {
    if (error && typeof error === "object" && "digest" in error) throw error;
    if (error instanceof ProjectConflictError)
      redirect(`/projects/${projectId}?status=conflict`);
    if (
      error instanceof Error &&
      error.message === "Upload preview expired or unavailable."
    )
      redirect(`/projects/${projectId}?status=preview-expired`);
    redirect(`/projects/${projectId}?status=sync-error`);
  }
}

export async function cancelProjectUploadAction(formData: FormData) {
  const user = await requireToolUser();
  const projectId = idSchema.parse(formData.get("projectId"));
  try {
    await cancelProjectUploadPreview(
      user.id,
      String(formData.get("token") ?? ""),
    );
  } catch {
    // Cancellation is intentionally idempotent.
  }
  redirect(`/projects/${projectId}`);
}

export async function shareProjectAction(form: FormData) {
  const user = await requireToolUser();
  const projectId = Number(form.get("projectId")),
    recipientId = Number(form.get("recipientId"));
  let status = "shared";
  try {
    if (
      form.get("enabled") === "1" &&
      !listVisibleUsers(user.id).some((u) => u.id === recipientId)
    )
      throw new Error("Pessoa não disponível.");
    withV2Db((db) =>
      setProjectShare(
        db,
        getDatabase(),
        user.id,
        projectId,
        recipientId,
        form.get("enabled") === "1",
      ),
    );
  } catch {
    status = "share-error";
  }
  revalidatePath("/library");
  revalidatePath(`/projects/${projectId}`);
  redirect(`/projects/${projectId}?from=projects&status=${status}`);
}
