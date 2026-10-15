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

export async function saveGlobalChatAvatarAction(
  form: FormData,
): Promise<{ error?: string; ok?: boolean }> {
  return withV2DbAsync(async (db) => {
    const admin = await currentAdminV2(db);
    if (!admin || admin.mustChangePassword)
      return { error: "Admin necessário." };
    try {
      const { ensureGlobalChatRoom } = await import("@/lib/v2/chat-state");
      const { getDatabase } = await import("@/lib/db/client");
      const roomId = ensureGlobalChatRoom(getDatabase());
      const { recordAdminAction } = await import("@/lib/v2/audit");
      if (form.get("remove") === "1") {
        db.prepare("DELETE FROM chat_room_avatars WHERE legacy_room_id=?").run(
          roomId,
        );
      } else {
        const file = form.get("avatar");
        if (
          !(file instanceof File) ||
          !file.size ||
          file.size > 5 * 1024 * 1024
        )
          return { error: "Escolha PNG, JPG ou WebP de até 5 MB." };
        const sharp = (await import("sharp")).default;
        const image = sharp(Buffer.from(await file.arrayBuffer()), {
          limitInputPixels: 20_000_000,
          failOn: "warning",
        });
        const meta = await image.metadata();
        if (!["png", "jpeg", "webp"].includes(meta.format ?? ""))
          return { error: "Use PNG, JPG ou WebP." };
        const data = await image
          .rotate()
          .resize(512, 512, { fit: "cover" })
          .webp({ quality: 85 })
          .toBuffer();
        db.prepare(
          "INSERT INTO chat_room_avatars(legacy_room_id,image,mime_type,version) VALUES(?,?,?,?) ON CONFLICT(legacy_room_id) DO UPDATE SET image=excluded.image,mime_type=excluded.mime_type,version=excluded.version",
        ).run(roomId, data, "image/webp", Date.now());
      }
      recordAdminAction(
        db,
        { kind: "admin", id: admin.id },
        "chat.global_avatar",
        "chat_room",
        roomId,
      );
      revalidatePath("/chat");
      return { ok: true };
    } catch {
      return {
        error:
          "Não foi possível alterar a imagem. Confira o arquivo e tente novamente.",
      };
    }
  });
}
