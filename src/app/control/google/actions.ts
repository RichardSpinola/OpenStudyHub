"use server";
import { recordAdminAction } from "@/lib/v2/audit";
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
  let result = "Conta responsável atualizada.";
  try {
    const value = String(form.get("ownerId") ?? "");
    const ownerId = value === "" ? null : Number(value);
    if (ownerId !== null && (!Number.isSafeInteger(ownerId) || ownerId <= 0))
      throw new Error("Usuário inválido.");
    await withV2DbAsync(async (db) => {
      const admin = await currentAdminV2(db);
      if (!admin || admin.mustChangePassword)
        throw new Error(
          "Entre com sua conta Admin e conclua a troca da senha temporária antes de continuar.",
        );
      setStorageOwner(db, admin, ownerId, getDatabase());
    });
  } catch (error) {
    result =
      error instanceof Error
        ? error.message
        : "Não foi possível configurar o armazenamento.";
    redirect(
      "/control/google?area=storage&error=" + encodeURIComponent(result),
    );
  }
  redirect("/control/google?area=storage&ok=" + encodeURIComponent(result));
}
export async function prepareDriveRootAction(form: FormData): Promise<void> {
  let message = "Pasta central pronta para uso.";
  try {
    const result = await withV2DbAsync(async (db) => {
      const admin = await currentAdminV2(db);
      if (!admin || admin.mustChangePassword)
        throw new Error(
          "Entre com sua conta Admin e conclua a troca da senha temporária antes de continuar.",
        );
      const owner = storageOwnerStatus(db);
      if (!owner?.connected)
        throw new Error("Conecte a conta responsável pelo Drive primeiro.");
      const result = await new GoogleDriveStorageProvider(
        db,
        owner.backendId,
      ).prepareRoot(
        admin,
        desiredRootFolderName(getDatabase()),
        form.get("replaceMissing") === "yes",
      );
      db.prepare(
        "UPDATE google_automation_v2 SET drive_status='pending',last_drive_check_at=NULL WHERE id=1",
      ).run();
      return result;
    });
    message =
      result.outcome === "recreated"
        ? "Nova pasta central criada. Os vínculos antigos foram preservados; arquivos excluídos não são recuperados por esta ação."
        : result.outcome === "restored"
          ? "Pasta central restaurada da lixeira."
          : result.outcome === "created"
            ? "Pasta central criada no Drive."
            : message;
  } catch (error) {
    redirect(
      "/control/google?area=storage&error=" +
        encodeURIComponent(
          error instanceof Error
            ? error.message
            : "Não foi possível preparar a pasta.",
        ),
    );
  }
  redirect("/control/google?area=storage&ok=" + encodeURIComponent(message));
}

export async function repairDriveRootAction(): Promise<void> {
  let message = "Diretório Drive reparado.";
  try {
    await withV2DbAsync(async (db) => {
      const admin = await currentAdminV2(db);
      if (!admin || admin.mustChangePassword)
        throw new Error(
          "Entre com sua conta Admin e conclua a troca da senha temporária antes de continuar.",
        );
      const owner = storageOwnerStatus(db);
      if (!owner?.ownerId || !owner.connected)
        throw new Error("A conta responsável precisa conectar o Google Drive.");
      const provider = new GoogleDriveStorageProvider(db, owner.backendId);
      await provider.repairRoot(admin, desiredRootFolderName(getDatabase()));
      db.prepare(
        "UPDATE google_automation_v2 SET drive_status='pending',last_drive_check_at=NULL WHERE id=1",
      ).run();
    });
  } catch (error) {
    message =
      error instanceof Error ? error.message : "Falha ao reparar Drive.";
    redirect(
      "/control/google?area=storage&error=" + encodeURIComponent(message),
    );
  }
  redirect("/control/google?area=storage&ok=" + encodeURIComponent(message));
}

export async function provisionDriveFoldersAction(
  form: FormData,
): Promise<void> {
  try {
    const created = await withV2DbAsync(async (db) => {
      const admin = await currentAdminV2(db);
      if (!admin || admin.mustChangePassword)
        throw new Error(
          "Entre com sua conta Admin e conclua a troca da senha temporária antes de continuar.",
        );
      return provisionPendingDriveFolders(db, admin, {
        recreateMissing: form.get("recreateMissing") === "yes",
      });
    });
    redirect(
      "/control/google?area=storage&ok=" +
        encodeURIComponent(
          `${created.checked} disciplina(s) conferida(s); ${created.created} pasta(s) preparada(s), ${created.recreated} recriada(s) e ${created.restored} restaurada(s) da lixeira.`,
        ),
    );
  } catch (error) {
    if (error && typeof error === "object" && "digest" in error) throw error;
    const message =
      error instanceof Error ? error.message : "Falha ao criar pastas Drive.";
    redirect(
      "/control/google?area=storage&error=" + encodeURIComponent(message),
    );
  }
}

export async function setGoogleAutomationAction(form: FormData): Promise<void> {
  try {
    const minutes = Number(form.get("intervalMinutes"));
    await withV2DbAsync(async (db) => {
      const admin = await currentAdminV2(db);
      if (!admin || admin.mustChangePassword)
        throw new Error(
          "Entre com sua conta Admin e conclua a troca da senha temporária antes de continuar.",
        );
      setGoogleAutomationInterval(db, admin, minutes);
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Intervalo inválido.";
    redirect("/control/google?error=" + encodeURIComponent(message));
  }
  redirect("/control/google?ok=Intervalo%20atualizado.");
}

export async function setDriveAccessPolicyAction(form: FormData) {
  const value = form.get("policy");
  if (value !== "app-only" && value !== "direct")
    redirect(
      "/control/google?area=storage&error=Escolha%20uma%20forma%20de%20acesso.",
    );
  await withV2DbAsync(async (db) => {
    const admin = await currentAdminV2(db);
    if (!admin || admin.mustChangePassword)
      throw new Error(
        "Entre com sua conta Admin e conclua a troca da senha temporária antes de continuar.",
      );
    getDatabase()
      .sqlite.prepare(
        "INSERT INTO app_settings(key,value,updated_at) VALUES('storage.drive_access_policy',?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=excluded.updated_at",
      )
      .run(value, Date.now());
    recordAdminAction(db, admin, "storage.access_policy", "app_setting", 0);
  });
  redirect("/control/google?area=storage&ok=Forma%20de%20acesso%20salva.");
}
