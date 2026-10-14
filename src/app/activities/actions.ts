"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { academicLocalDateTime } from "@/lib/academic-clock";
import { academicTimeZoneForLegacyUser } from "@/lib/v2/academic-timezone";
import { withV2Db } from "@/lib/v2/runtime-database";
import { z } from "zod";

import {
  activityStatusSchema,
  createActivity,
  setActivityStatus,
  updateActivity,
} from "@/lib/activities";
import { requireAuthenticatedUser } from "@/lib/authorization";

const idSchema = z.coerce.number().int().positive();

function text(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function dueDate(formData: FormData, userId: number): Date | null {
  const value = text(formData, "dueAt");
  if (!value) return null;
  const zone =
    process.env.OPENSTUDYHUB_V2_ENABLED === "1"
      ? withV2Db((db) => academicTimeZoneForLegacyUser(db, userId))
      : undefined;
  const date = academicLocalDateTime(value, zone);
  if (Number.isNaN(date.getTime())) throw new Error("Invalid due date.");
  return date;
}

function refresh() {
  revalidatePath("/");
  revalidatePath("/activities");
  revalidatePath("/today");
}

export async function createActivityAction(formData: FormData) {
  const user = await requireAuthenticatedUser();
  try {
    createActivity(user.id, {
      offeringId: idSchema.parse(formData.get("offeringId")),
      title: text(formData, "title"),
      description: text(formData, "description"),
      dueAt: dueDate(formData, user.id),
      status: "pending",
    });
    refresh();
  } catch {
    redirect("/activities?status=error");
  }
  redirect("/activities?status=ok");
}

export async function updateActivityAction(formData: FormData) {
  const user = await requireAuthenticatedUser();
  try {
    updateActivity(user.id, idSchema.parse(formData.get("activityId")), {
      offeringId: idSchema.parse(formData.get("offeringId")),
      title: text(formData, "title"),
      description: text(formData, "description"),
      dueAt: dueDate(formData, user.id),
      status: activityStatusSchema.parse(formData.get("status")),
    });
    refresh();
  } catch {
    redirect("/activities?status=error");
  }
  redirect("/activities?status=ok");
}

export async function setActivityStatusAction(formData: FormData) {
  const user = await requireAuthenticatedUser();
  try {
    setActivityStatus(
      user.id,
      idSchema.parse(formData.get("activityId")),
      activityStatusSchema.parse(formData.get("status")),
    );
    refresh();
  } catch {
    redirect("/activities?status=error");
  }
  redirect("/activities?status=ok");
}
