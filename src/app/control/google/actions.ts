"use server";
import { redirect } from "next/navigation";
import { withV2DbAsync, currentAdminV2 } from "@/lib/v2/runtime";
import {
  setStorageOwner,
  GoogleDriveStorageProvider,
  storageOwnerStatus,
} from "@/lib/v2/drive-storage";
import { provisionPendingDriveFolders } from "@/lib/v2/drive-folders";
import { desiredRootFolderName } from "@/lib/google/drive";
import { getDatabase } from "@/lib/db/client";
import { setGoogleAutomationInterval } from "@/lib/v2/google-automation";

export async function setStorageOwnerAction(form: FormData): Promise<void> {
  let result = "Storage owner atualizado.";
  try {
    const value = String(form.get("ownerId") ?? "");
    const ownerId = value === "" ? null : Number(value);
    if (ownerId !== null && (!Number.isSafeInteger(ownerId) || ownerId <= 0))
      throw new Error("Usuário inválido.");
    await withV2DbAsync(async (db) => {
      const admin = await currentAdminV2(db);
      if (!admin) throw new Error("Sessão Admin necessária.");
      setStorageOwner(db, admin, ownerId);
    });
  } catch (error) {
    result =
      error instanceof Error ? error.message : "Falha ao configurar storage.";
    redirect("/control/google?error=" + encodeURIComponent(result));
  }
  redirect("/control/google?ok=" + encodeURIComponent(result));
}
export async function repairDriveRootAction(): Promise<void> {
  let message = "Diretório Drive reparado.";
  try {
    await withV2DbAsync(async (db) => {
      const admin = await currentAdminV2(db);
      if (!admin) throw new Error("Sessão Admin necessária.");
      const owner = storageOwnerStatus(db);
      if (!owner?.ownerId || !owner.connected)
        throw new Error("Storage owner precisa conectar Drive.");
      const provider = new GoogleDriveStorageProvider(db, owner.backendId);
      await provider.repairRoot(admin, desiredRootFolderName(getDatabase()));
      db.prepare(
        "UPDATE google_automation_v2 SET drive_status='pending',last_drive_check_at=NULL WHERE id=1",
      ).run();
    });
  } catch (error) {
    message =
      error instanceof Error ? error.message : "Falha ao reparar Drive.";
    redirect("/control/google?error=" + encodeURIComponent(message));
  }
  redirect("/control/google?ok=" + encodeURIComponent(message));
}

export async function provisionDriveFoldersAction(): Promise<void> {
  try {
    const created = await withV2DbAsync(async (db) => {
      const admin = await currentAdminV2(db);
      if (!admin) throw new Error("Sessão Admin necessária.");
      return provisionPendingDriveFolders(db, admin);
    });
    redirect(
      "/control/google?ok=" +
        encodeURIComponent(
          `${created.checked} disciplina(s) conferida(s); ${created.created} pasta(s) criada(s) ou recriada(s).`,
        ),
    );
  } catch (error) {
    if (error && typeof error === "object" && "digest" in error) throw error;
    const message =
      error instanceof Error ? error.message : "Falha ao criar pastas Drive.";
    redirect("/control/google?error=" + encodeURIComponent(message));
  }
}

export async function setGoogleAutomationAction(form: FormData): Promise<void> {
  try {
    const minutes = Number(form.get("intervalMinutes"));
    await withV2DbAsync(async (db) => {
      const admin = await currentAdminV2(db);
      if (!admin) throw new Error("Sessão Admin necessária.");
      setGoogleAutomationInterval(db, admin, minutes);
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Intervalo inválido.";
    redirect("/control/google?error=" + encodeURIComponent(message));
  }
  redirect("/control/google?ok=Intervalo%20atualizado.");
}
