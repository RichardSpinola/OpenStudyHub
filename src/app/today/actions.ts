"use server";

import { revalidatePath } from "next/cache";

import { requireAuthenticatedUser } from "@/lib/authorization";
import { setTodayWidgetEnabled } from "@/lib/profile";

export async function disableTodayWidgetAction() {
  const user = await requireAuthenticatedUser();
  setTodayWidgetEnabled(user.id, false);
  revalidatePath("/");
  revalidatePath("/settings");
}
