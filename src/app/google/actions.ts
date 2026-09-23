"use server";
import { redirect } from "next/navigation";
import { withV2DbAsync, currentUserV2 } from "@/lib/v2/runtime";
import {
  startGoogleV2,
  completeGoogleV2,
  disconnectGoogleV2,
} from "@/lib/v2/google-oauth";
import {
  discoverClassrooms,
  confirmClassrooms,
  parseClassroomAssignments,
  GoogleClassroomAdapter,
} from "@/lib/v2/classroom";
import {
  fakeClassroomAdapter,
  fakeGoogleConfig,
  fakeGoogleEnabled,
  fakeGoogleFetch,
} from "@/lib/v2/fake-google";

function back(error?: string, ok?: string) {
  const url = new URL("/google", "http://local.invalid");
  if (error) url.searchParams.set("error", error.slice(0, 180));
  if (ok) url.searchParams.set("ok", ok.slice(0, 180));
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
      await disconnectGoogleV2(
        db,
        user.id,
        fakeGoogleEnabled()
          ? {
              config: fakeGoogleConfig(),
              fetchImpl: fakeGoogleFetch(db, user.id),
            }
          : {},
      );
    });
  } catch (error) {
    redirect(
      back(error instanceof Error ? error.message : "Falha ao desconectar."),
    );
  }
  redirect(back(undefined, "Conta Google desconectada."));
}
export async function discoverClassroomsAction(): Promise<void> {
  try {
    await withV2DbAsync(async (db) => {
      const user = await currentUserV2(db);
      if (!user || user.mustChangePassword)
        throw new Error("Sessão normal necessária.");
      await discoverClassrooms(
        db,
        user.id,
        fakeGoogleEnabled()
          ? fakeClassroomAdapter(db, user.id)
          : new GoogleClassroomAdapter(db),
      );
    });
  } catch (error) {
    redirect(
      back(
        error instanceof Error ? error.message : "Falha ao buscar Classrooms.",
      ),
    );
  }
  redirect(back(undefined, "Classrooms carregados. Revise as associações."));
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
  redirect(back(undefined, "Associações confirmadas."));
}
export async function connectFakeGoogleAction(): Promise<void> {
  try {
    if (!fakeGoogleEnabled()) throw new Error("Modo fictício indisponível.");
    await withV2DbAsync(async (db) => {
      const user = await currentUserV2(db);
      if (!user || user.mustChangePassword)
        throw new Error("Sessão normal necessária.");
      const config = fakeGoogleConfig();
      const state = new URL(
        startGoogleV2(db, user.id, true, { config }),
      ).searchParams.get("state")!;
      await completeGoogleV2(db, user.id, "fake-code", state, {
        config,
        fetchImpl: fakeGoogleFetch(db, user.id),
      });
    });
  } catch (error) {
    redirect(
      back(
        error instanceof Error ? error.message : "Falha no Google fictício.",
      ),
    );
  }
  redirect(back(undefined, "Google fictício conectado."));
}
export async function simulateFakeGoogleAction(form: FormData): Promise<void> {
  try {
    if (!fakeGoogleEnabled()) throw new Error("Modo fictício indisponível.");
    await withV2DbAsync(async (db) => {
      const user = await currentUserV2(db);
      if (!user) throw new Error("Sessão normal necessária.");
      if (form.get("scenario") === "revoked")
        db.prepare(
          "UPDATE google_connections_v2 SET encrypted_refresh_token=NULL,status='needs_reconnect' WHERE user_id=?",
        ).run(user.id);
      else if (form.get("scenario") === "stale")
        db.prepare(
          "UPDATE classroom_sync_v2 SET last_success_at=0,status='ready' WHERE user_id=?",
        ).run(user.id);
      else throw new Error("Cenário inválido.");
    });
  } catch (error) {
    redirect(
      back(
        error instanceof Error ? error.message : "Falha no cenário fictício.",
      ),
    );
  }
  redirect(back(undefined, "Cenário fictício aplicado."));
}
