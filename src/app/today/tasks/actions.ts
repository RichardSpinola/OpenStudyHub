"use server";
import { revalidatePath } from "next/cache";
import { requireToolUser } from "@/lib/authorization";
import { academicLocalDateTime } from "@/lib/academic-clock";
import { personalPlanningContext } from "@/lib/personal-planning-context";
import {
  savePersonalTask,
  setPersonalTaskCompleted,
  deletePersonalTask,
} from "@/lib/personal-tasks";
export async function saveTaskAction(input: {
  id?: number;
  title: string;
  description: string;
  offeringKey: string;
  due: string;
}) {
  const user = await requireToolUser();
  try {
    const zone = personalPlanningContext(user.id).timeZone;
    const id = savePersonalTask(
      user.id,
      {
        title: input.title,
        description: input.description,
        offeringKey: input.offeringKey || null,
        dueAt: input.due
          ? academicLocalDateTime(input.due, zone).getTime()
          : null,
      },
      input.id,
    );
    revalidatePath("/today");
    revalidatePath("/today/tasks");
    return { ok: true as const, id };
  } catch (error) {
    return {
      ok: false as const,
      error:
        error instanceof Error && error.message === "limit" ? "limit" : "save",
    };
  }
}
export async function changeTaskAction(
  id: number,
  operation: "complete" | "reopen" | "delete",
) {
  const user = await requireToolUser();
  try {
    if (operation === "delete") deletePersonalTask(user.id, id);
    else if (operation === "complete" || operation === "reopen")
      setPersonalTaskCompleted(user.id, id, operation === "complete");
    else throw new Error("operation");
    revalidatePath("/today");
    revalidatePath("/today/tasks");
    return { ok: true as const };
  } catch {
    return { ok: false as const, error: "change" };
  }
}
