"use server";
import { redirect } from "next/navigation";
import { withV2DbAsync, currentUserV2 } from "@/lib/v2/runtime";
import { startGoogleV2, disconnectGoogleV2 } from "@/lib/v2/google-oauth";
import {
  discoverClassrooms,
  confirmClassrooms,
  parseClassroomAssignments,
  GoogleClassroomAdapter,
} from "@/lib/v2/classroom";

function back(error?: string, ok?: string, step?: string) {
  const url = new URL("/google", "http://local.invalid");
  if (error) url.searchParams.set("error", error.slice(0, 180));
  if (ok) url.searchParams.set("ok", ok.slice(0, 180));
  if (step) url.searchParams.set("step", step);
  return url.pathname + url.search;
}
export async function connectGoogleV2Action(form: FormData): Promise<void> {
  let destination: string;
  try {
    destination = await withV2DbAsync(async (db) => {
      const user = await currentUserV2(db);
      if (!user || user.mustChangePassword)
        throw new Error("Entre com sua conta normal.");
      return startGoogleV2(db, user.id, form.get("drive") === "1");
    });
  } catch (error) {
    redirect(
      back(
        error instanceof Error ? error.message : "Falha ao conectar Google.",
      ),
    );
  }
  redirect(destination);
}
export async function disconnectGoogleV2Action(): Promise<void> {
  try {
    await withV2DbAsync(async (db) => {
      const user = await currentUserV2(db);
      if (!user) throw new Error("Sessão normal necessária.");
      await disconnectGoogleV2(db, user.id);
    });
  } catch (error) {
    redirect(
      back(error instanceof Error ? error.message : "Falha ao desconectar."),
    );
  }
  redirect(back(undefined, "Conta Google desconectada.", "connect"));
}
export async function discoverClassroomsAction(): Promise<void> {
  try {
    await withV2DbAsync(async (db) => {
      const user = await currentUserV2(db);
      if (!user || user.mustChangePassword)
        throw new Error("Sessão normal necessária.");
      await discoverClassrooms(db, user.id, new GoogleClassroomAdapter(db));
    });
  } catch (error) {
    redirect(
      back(
        error instanceof Error ? error.message : "Falha ao buscar Classrooms.",
      ),
    );
  }
  redirect(
    back(undefined, "Classrooms carregados. Revise as associações.", "mapping"),
  );
}
export async function confirmClassroomsAction(form: FormData): Promise<void> {
  try {
    await withV2DbAsync(async (db) => {
      const user = await currentUserV2(db);
      if (!user || user.mustChangePassword)
        throw new Error("Sessão normal necessária.");
      const assignments = parseClassroomAssignments(form);
      if (!assignments.length)
        throw new Error("Envie ao menos uma matéria para revisão.");
      confirmClassrooms(db, user.id, assignments);
    });
  } catch (error) {
    redirect(
      back(
        error instanceof Error
          ? error.message
          : "Falha ao confirmar associações.",
      ),
    );
  }
  redirect(back(undefined, "Associações confirmadas.", "done"));
}
