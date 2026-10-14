import type { V2Database } from "./database";
import type { DatabaseConnection } from "../db/client";
import { withV2Db } from "./runtime-database";
export function sharedProjectIds(legacyUserId: number): number[] {
  if (process.env.OPENSTUDYHUB_V2_ENABLED !== "1") return [];
  return withV2Db((db) => sharedProjectIdsIn(db, legacyUserId));
}
export function setProjectShare(
  db: V2Database,
  legacy: DatabaseConnection,
  legacyOwnerId: number,
  projectId: number,
  legacyRecipientId: number,
  enabled: boolean,
) {
  if (
    !legacy.sqlite
      .prepare(
        "SELECT 1 FROM projects WHERE id=? AND owner_user_id=? AND archived_at IS NULL",
      )
      .get(projectId, legacyOwnerId)
  )
    throw new Error("Somente o proprietário pode compartilhar este projeto.");
  const identity = (id: number, active = true) =>
    (
      db
        .prepare(
          `SELECT l.user_id id FROM legacy_user_links l JOIN users u ON u.id=l.user_id ${active ? "AND u.active=1" : ""} WHERE l.legacy_user_id=?`,
        )
        .get(id) as { id: number } | undefined
    )?.id;
  const owner = identity(legacyOwnerId),
    recipient = identity(legacyRecipientId, enabled);
  if (!owner || !recipient || owner === recipient)
    throw new Error("Escolha outra pessoa com uma conta ativa.");
  if (enabled)
    db.prepare(
      "INSERT INTO project_shares_v2(legacy_project_id,owner_user_id,recipient_user_id) VALUES(?,?,?) ON CONFLICT(legacy_project_id,recipient_user_id) DO NOTHING",
    ).run(projectId, owner, recipient);
  else
    db.prepare(
      "DELETE FROM project_shares_v2 WHERE legacy_project_id=? AND owner_user_id=? AND recipient_user_id=?",
    ).run(projectId, owner, recipient);
}
export function listProjectShares(projectId: number, legacyOwnerId: number) {
  if (process.env.OPENSTUDYHUB_V2_ENABLED !== "1") return [];
  return withV2Db(
    (db) =>
      db
        .prepare(
          `SELECT l.legacy_user_id id,u.display_name name FROM project_shares_v2 s JOIN users u ON u.id=s.recipient_user_id JOIN legacy_user_links l ON l.user_id=u.id JOIN legacy_user_links owner ON owner.user_id=s.owner_user_id WHERE s.legacy_project_id=? AND owner.legacy_user_id=?`,
        )
        .all(projectId, legacyOwnerId) as Array<{ id: number; name: string }>,
  );
}

export function sharedProjectIdsIn(db: V2Database, legacyUserId: number) {
  return (
    db
      .prepare(
        `SELECT s.legacy_project_id id FROM project_shares_v2 s JOIN legacy_user_links l ON l.user_id=s.recipient_user_id JOIN users recipient ON recipient.id=s.recipient_user_id AND recipient.active=1 JOIN users owner ON owner.id=s.owner_user_id AND owner.active=1 WHERE l.legacy_user_id=?`,
      )
      .all(legacyUserId) as Array<{ id: number }>
  ).map((row) => row.id);
}
