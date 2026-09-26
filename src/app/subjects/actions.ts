"use server";

import { redirect } from "next/navigation";
import {
  getAcademicPreferences,
  updateAcademicPreferences,
} from "@/lib/academic-preferences";
import { requireAuthenticatedUser } from "@/lib/authorization";

export async function toggleSubjectHistoryAction(): Promise<void> {
  const user = await requireAuthenticatedUser();
  updateAcademicPreferences(user.id, {
    showSubjectHistory: !getAcademicPreferences(user.id).showSubjectHistory,
  });
  redirect("/subjects");
}
