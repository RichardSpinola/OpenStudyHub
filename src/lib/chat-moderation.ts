import { z } from "zod";
import { getDatabase, type DatabaseConnection } from "@/lib/db/client";
import { canAccessChatRoom } from "@/lib/chat";
import { getAcademicAuthority } from "@/lib/academic-authority";
export function canModerateRoom(
  userId: number,
  roomId: number,
  db: DatabaseConnection = getDatabase(),
) {
  if (!canAccessChatRoom(userId, roomId, db)) return false;
  const a = db.sqlite
    .prepare(
      "SELECT a.audience_type type,a.program_id programId,a.cohort_id cohortId,c.program_id cohortProgramId FROM chat_room_audiences a LEFT JOIN cohorts c ON c.id=a.cohort_id WHERE a.room_id=?",
    )
    .get(roomId) as
    | {
        type: string;
        programId: number | null;
        cohortId: number | null;
        cohortProgramId: number | null;
      }
    | undefined;
  if (!a) return false;
  const authority = getAcademicAuthority(userId, db);
  return (
    authority.role === "admin" ||
    (authority.role === "moderator" &&
      ((a.type === "program" && authority.programIds.includes(a.programId!)) ||
        (a.type === "cohort" &&
          authority.programIds.includes(a.cohortProgramId!)))) ||
    (authority.role === "curator" &&
      a.type === "cohort" &&
      authority.cohortIds.includes(a.cohortId!))
  );
}
export function reportChatMessage(
  userId: number,
  roomId: number,
  messageId: number,
  reasonInput: string,
  db: DatabaseConnection = getDatabase(),
) {
  const reason = z.string().trim().min(3).max(1000).parse(reasonInput);
  if (!canAccessChatRoom(userId, roomId, db))
    throw new Error("Conversa indisponível.");
  const msg = db.sqlite
    .prepare(
      "SELECT body_source body FROM chat_messages WHERE id=? AND room_id=? AND deleted_at IS NULL",
    )
    .get(messageId, roomId) as { body: string } | undefined;
  if (!msg) throw new Error("Mensagem indisponível.");
  const old = db.sqlite
    .prepare(
      "SELECT id FROM chat_reports WHERE reporter_id=? AND message_id=? AND resolved_at IS NULL",
    )
    .get(userId, messageId) as { id: number } | undefined;
  if (old) return old.id;
  return Number(
    db.sqlite
      .prepare(
        "INSERT INTO chat_reports(reporter_id,message_id,room_id,excerpt,reason,created_at) VALUES(?,?,?,?,?,?)",
      )
      .run(
        userId,
        messageId,
        roomId,
        msg.body || "[Imagem anexada; arquivo não incluído na denúncia]",
        reason,
        Date.now(),
      ).lastInsertRowid,
  );
}
