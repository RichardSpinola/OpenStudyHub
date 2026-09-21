"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { requireAuthenticatedUser } from "@/lib/authorization";
import {
  isClassroomSyncFresh,
  syncClassroomSubject,
} from "@/lib/google/classroom";
import { getServerEnvironment } from "@/lib/env";

const idSchema = z.coerce.number().int().positive();

export async function syncClassroomActivitiesAction(formData: FormData) {
  const user = await requireAuthenticatedUser();
  const subjectId = idSchema.parse(formData.get("subjectId"));
  let ok = true;
  try {
    await syncClassroomSubject(
      user.id,
      idSchema.parse(formData.get("offeringId")),
      {
        includeHistory: formData.get("includeHistory") === "true",
      },
    );
  } catch {
    ok = false;
  }
  redirect(`/subjects/${subjectId}?google=${ok ? "synced" : "error"}`);
}

export async function autoSyncClassroomAction(offeringIdInput: number) {
  const user = await requireAuthenticatedUser();
  const offeringId = idSchema.parse(offeringIdInput);
  if (
    isClassroomSyncFresh(
      user.id,
      offeringId,
      getServerEnvironment().CLASSROOM_SYNC_TTL_MINUTES,
    )
  ) {
    return { status: "fresh" as const };
  }
  try {
    await syncClassroomSubject(user.id, offeringId);
    return { status: "synced" as const };
  } catch {
    return { status: "error" as const };
  }
}
