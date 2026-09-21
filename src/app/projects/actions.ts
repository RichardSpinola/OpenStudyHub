"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { requireAuthenticatedUser } from "@/lib/authorization";
import {
  archiveUserProject,
  cancelProjectUploadPreview,
  confirmProjectUpload,
  createProject,
  getUserProject,
  ProjectConflictError,
} from "@/lib/projects";
import {
  projectLanguageSchema,
  projectTechnologySchema,
} from "@/lib/project-manifest";

const idSchema = z.coerce.number().int().positive();

export async function createProjectAction(formData: FormData) {
  const user = await requireAuthenticatedUser();
  try {
    const project = createProject(user.id, {
      offeringId: idSchema.parse(formData.get("offeringId")),
      name: String(formData.get("name") ?? ""),
      language: projectLanguageSchema.parse(formData.get("language")),
      ignorePreset: projectLanguageSchema.parse(formData.get("ignorePreset")),
      technologies: formData
        .getAll("technologies")
        .map((value) => projectTechnologySchema.parse(value)),
      description: String(formData.get("description") ?? ""),
    });
    redirect(`/projects/${project.id}?status=created`);
  } catch (error) {
    if (error && typeof error === "object" && "digest" in error) throw error;
    redirect("/subjects?status=project-error");
  }
}

export async function archiveProjectAction(formData: FormData) {
  const user = await requireAuthenticatedUser();
  const projectId = idSchema.parse(formData.get("projectId"));
  const project = getUserProject(user.id, projectId);
  archiveUserProject(user.id, project.id);
  revalidatePath("/subjects");
  redirect(`/subjects/${project.subjectId}?view=projects&status=archived`);
}

export async function confirmProjectUploadAction(formData: FormData) {
  const user = await requireAuthenticatedUser();
  const projectId = idSchema.parse(formData.get("projectId"));
  try {
    await confirmProjectUpload(
      user.id,
      String(formData.get("token") ?? ""),
      String(formData.get("message") ?? ""),
    );
    revalidatePath(`/projects/${projectId}`);
    revalidatePath("/subjects");
    redirect(`/projects/${projectId}?status=synced`);
  } catch (error) {
    if (error && typeof error === "object" && "digest" in error) throw error;
    redirect(
      `/projects/${projectId}?status=${error instanceof ProjectConflictError ? "conflict" : "sync-error"}`,
    );
  }
}

export async function cancelProjectUploadAction(formData: FormData) {
  const user = await requireAuthenticatedUser();
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
