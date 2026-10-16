"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireControlAdmin } from "@/lib/v2/control-auth";
import {
  backupConfig,
  hasRecoveryKey,
  runEncryptedBackup,
  saveBackupConfig,
} from "@/lib/v2/backup-service";
import { withBackupLease, finishBackupSnapshot } from "@/lib/v2/maintenance";
// The recovery key is never included in audit logs, URLs or page props.
export async function configureBackupAction(input: {
  enabled: boolean;
  time: string;
  timeZone: string;
  retention: number;
  destination: string;
  key?: string;
  confirmed: boolean;
}) {
  await requireControlAdmin();
  try {
    if (!hasRecoveryKey() && !input.confirmed)
      return {
        error: "Guarde a chave de recuperação e confirme antes de continuar.",
      };
    await withBackupLease(async () => {
      saveBackupConfig({ ...backupConfig(), ...input }, input.key);
      finishBackupSnapshot();
    });
    revalidatePath("/control/system");
    return { ok: true };
  } catch (error) {
    if (error instanceof z.ZodError)
      return {
        error: "Confira o horário, o fuso e a quantidade de cópias (1 a 90).",
      };
    return {
      error:
        error instanceof Error ? error.message : "Não foi possível salvar.",
    };
  }
}
export async function encryptedBackupAction() {
  await requireControlAdmin();
  try {
    const run = await runEncryptedBackup();
    revalidatePath("/control/system");
    return {
      ok: run.status !== "error",
      id: run.id,
      status: run.status,
      message: run.message,
    };
  } catch {
    return {
      ok: false,
      message:
        "Backup indisponível. Confira a chave e se já há uma cópia em andamento.",
    };
  }
}

export async function configurePushAction(subject: string) {
  await requireControlAdmin();
  try {
    const { generatePushConfiguration } = await import("@/lib/v2/push-config");
    generatePushConfiguration(subject);
    revalidatePath("/control/system");
    return { ok: true };
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? error.message
          : "Não foi possível configurar notificações.",
    };
  }
}
