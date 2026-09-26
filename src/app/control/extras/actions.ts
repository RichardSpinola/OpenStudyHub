"use server";

import { revalidatePath } from "next/cache";
import { currentAdminV2, withV2DbAsync } from "@/lib/v2/runtime";
import {
  extraKeys,
  updateExtrasFlags,
  type ExtrasFlags,
} from "@/lib/v2/extras";

export async function saveExtrasAction(form: FormData) {
  await withV2DbAsync(async (db) => {
    const admin = await currentAdminV2(db);
    if (!admin || admin.mustChangePassword)
      throw new Error("Admin necessário.");
    const flags = Object.fromEntries(
      extraKeys.map((key) => [key, form.get(key) === "on"]),
    ) as ExtrasFlags;
    updateExtrasFlags(db, flags);
  });
  revalidatePath("/", "layout");
  revalidatePath("/extras");
}
