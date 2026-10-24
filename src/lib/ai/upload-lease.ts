import { randomUUID } from "node:crypto";
import { getDatabase } from "@/lib/db/client";
import { requireAi } from "./generation";
export function claimAiUpload(userId: number) {
  const db = getDatabase().sqlite;
  const token = db
    .transaction(() => {
      const state = requireAi();
      db.prepare("DELETE FROM ai_upload_leases WHERE expires_at<?").run(
        Date.now(),
      );
      if (
        db
          .prepare("SELECT 1 FROM ai_upload_leases WHERE user_id=?")
          .get(userId) ||
        (
          db.prepare("SELECT count(*) n FROM ai_upload_leases").get() as {
            n: number;
          }
        ).n >= state.config.concurrency
      )
        throw new Error(
          "Outro envio está em andamento. Tente novamente em instantes. / Another upload is in progress. Try again shortly.",
        );
      const id = randomUUID();
      db.prepare("INSERT INTO ai_upload_leases VALUES(?,?,?)").run(
        userId,
        id,
        Date.now() + 300000,
      );
      return id;
    })
    .immediate();
  return () =>
    db.prepare("DELETE FROM ai_upload_leases WHERE token=?").run(token);
}
