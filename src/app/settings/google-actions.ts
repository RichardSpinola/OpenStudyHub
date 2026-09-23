"use server";

import { redirect } from "next/navigation";

import { requireAuthenticatedUser } from "@/lib/authorization";
import { getServerEnvironment } from "@/lib/env";
import {
  syncAllAccessibleClassrooms,
  type ClassroomSyncAllResult,
} from "@/lib/google/classroom";
import {
  createGoogleAuthorizationUrl,
  disconnectGoogleAccount,
} from "@/lib/google/oauth";

export async function connectGoogleAccountAction() {
  const user = await requireAuthenticatedUser();
  if (process.env.OPENSTUDYHUB_V2_ENABLED === "1") redirect("/google");
  redirect(createGoogleAuthorizationUrl(user.id));
}

export async function disconnectGoogleAccountAction() {
  const user = await requireAuthenticatedUser();
  if (process.env.OPENSTUDYHUB_V2_ENABLED === "1") redirect("/google");
  await disconnectGoogleAccount(user.id);
  redirect("/settings?google=disconnected");
}

export type SyncAllClassroomsState = {
  results: ClassroomSyncAllResult[];
  message?: string;
};

export async function syncAllClassroomsAction(
  _previous: SyncAllClassroomsState,
): Promise<SyncAllClassroomsState> {
  void _previous;
  const user = await requireAuthenticatedUser();
  if (process.env.OPENSTUDYHUB_V2_ENABLED === "1")
    return {
      results: [],
      message: "Use a página Google para sincronizar seus Classrooms.",
    };
  try {
    const results = await syncAllAccessibleClassrooms(
      user.id,
      getServerEnvironment().CLASSROOM_SYNC_TTL_MINUTES,
    );
    return {
      results,
      ...(results.length
        ? {}
        : { message: "Nenhuma matéria acessível possui Classroom mapeado." }),
    };
  } catch {
    return {
      results: [],
      message: "Não foi possível iniciar a sincronização do Classroom.",
    };
  }
}
