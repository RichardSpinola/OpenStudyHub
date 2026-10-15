"use server";
import { currentAdminV2, withV2DbAsync } from "@/lib/v2/runtime";
import { getDatabase } from "@/lib/db/client";
import { recordAdminAction } from "@/lib/v2/audit";
import { revalidatePath } from "next/cache";
export async function moderateGlobalAction(form: FormData) {
  return withV2DbAsync(async (db) => {
    const admin = await currentAdminV2(db);
    if (!admin || admin.mustChangePassword)
      throw new Error("Admin necessário.");
    const connection = getDatabase(),
      messageId = Number(form.get("messageId")),
      reportId = Number(form.get("reportId"));
    if (form.get("intent") === "dismiss") {
      if (!Number.isSafeInteger(reportId))
        throw new Error("Denúncia inválida.");
      connection.sqlite
        .prepare("UPDATE chat_reports SET resolved_at=? WHERE id=?")
        .run(Date.now(), reportId);
      recordAdminAction(
        db,
        { kind: "admin", id: admin.id },
        "chat.report_resolve",
        "chat_report",
        reportId,
      );
    } else {
      if (!Number.isSafeInteger(messageId) || messageId < 1)
        throw new Error("Mensagem inválida.");
      const allowed = connection.sqlite
        .prepare(
          "SELECT 1 FROM chat_messages m WHERE m.id=? AND (EXISTS(SELECT 1 FROM chat_room_audiences a WHERE a.room_id=m.room_id) OR EXISTS(SELECT 1 FROM chat_reports r WHERE r.message_id=m.id AND r.resolved_at IS NULL))",
        )
        .get(messageId);
      if (!allowed) throw new Error("Mensagem indisponível para moderação.");
      connection.sqlite
        .prepare(
          "UPDATE chat_messages SET deleted_at=? WHERE id=? AND deleted_at IS NULL",
        )
        .run(Date.now(), messageId);
      connection.sqlite
        .prepare("UPDATE chat_reports SET resolved_at=? WHERE message_id=?")
        .run(Date.now(), messageId);
      recordAdminAction(
        db,
        { kind: "admin", id: admin.id },
        "chat.moderate_remove",
        "chat_message",
        messageId,
      );
    }
    revalidatePath("/control/chat");
    revalidatePath("/chat");
  });
}
