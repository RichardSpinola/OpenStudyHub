"use server";
import { redirect } from "next/navigation";
import { withV2DbAsync, currentAdminV2 } from "@/lib/v2/runtime";
import {
  setStorageOwner,
  GoogleDriveStorageProvider,
  storageOwnerStatus,
} from "@/lib/v2/drive-storage";
import { fakeDriveProvider, fakeGoogleEnabled } from "@/lib/v2/fake-google";

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
      const provider = fakeGoogleEnabled()
        ? fakeDriveProvider(db, owner.backendId, owner.ownerId)
        : new GoogleDriveStorageProvider(db, owner.backendId);
      await provider.repairRoot(admin);
    });
  } catch (error) {
    message =
      error instanceof Error ? error.message : "Falha ao reparar Drive.";
    redirect("/control/google?error=" + encodeURIComponent(message));
  }
  redirect("/control/google?ok=" + encodeURIComponent(message));
}
