import { randomUUID } from "node:crypto";

import type { Actor } from "./actor";
import { isAdmin } from "./access";
import { recordAdminAction } from "./audit";
import {
  GoogleClassroomAdapter,
  classroomCache,
  syncClassroom,
} from "./classroom";
import type { V2Database } from "./database";
import { storageOwnerStatus } from "./drive-storage";
import { googleAccessTokenV2 } from "./google-oauth";

const allowedIntervals = new Set([0, 15, 30, 60, 120, 360]);
const driveApi = "https://www.googleapis.com/drive/v3/files";

export function googleAutomationStatus(db: V2Database) {
  return db
    .prepare(
      `SELECT interval_minutes intervalMinutes,last_run_at lastRunAt,
              last_finished_at lastFinishedAt,last_drive_check_at lastDriveCheckAt,
              drive_status driveStatus
       FROM google_automation_v2 WHERE id=1`,
    )
    .get() as {
    intervalMinutes: number;
    lastRunAt: number | null;
    lastFinishedAt: number | null;
    lastDriveCheckAt: number | null;
    driveStatus:
      | "pending"
      | "ready"
      | "needs_reconnect"
      | "permission_denied"
      | "missing"
      | "error";
  };
}

export function setGoogleAutomationInterval(
  db: V2Database,
  actor: Actor,
  minutes: number,
) {
  if (!isAdmin(db, actor))
    throw new Error("Somente Admin pode alterar a sincronização automática.");
  if (!allowedIntervals.has(minutes)) throw new Error("Intervalo inválido.");
  db.prepare(
    "UPDATE google_automation_v2 SET interval_minutes=? WHERE id=1",
  ).run(minutes);
  recordAdminAction(
    db,
    actor,
    "google.automation_interval",
    "google_automation",
    1,
  );
}

async function checkDriveHealth(
  db: V2Database,
): Promise<
  | "pending"
  | "ready"
  | "needs_reconnect"
  | "permission_denied"
  | "missing"
  | "error"
> {
  const owner = storageOwnerStatus(db);
  if (!owner?.ownerId || !owner.rootReady) return "pending";
  if (!owner.connected) return "needs_reconnect";
  const root = db
    .prepare("SELECT root_ref ref FROM storage_backends WHERE id=?")
    .get(owner.backendId) as { ref: string };
  try {
    const token = await googleAccessTokenV2(db, owner.ownerId);
    const response = await fetch(
      `${driveApi}/${encodeURIComponent(root.ref)}?fields=id,mimeType,trashed`,
      {
        headers: { authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(15_000),
      },
    );
    if (response.status === 403) return "permission_denied";
    if (response.status === 404) return "missing";
    if (!response.ok) return "error";
    const metadata = (await response.json()) as {
      mimeType?: string;
      trashed?: boolean;
    };
    return metadata.trashed ||
      metadata.mimeType !== "application/vnd.google-apps.folder"
      ? "missing"
      : "ready";
  } catch (error) {
    return error instanceof Error && error.message.includes("Reconecte")
      ? "needs_reconnect"
      : "error";
  }
}

export async function runDueGoogleAutomation(
  db: V2Database,
  now = Date.now(),
): Promise<boolean> {
  const token = randomUUID();
  const acquired = db
    .prepare(
      `UPDATE google_automation_v2 SET lease_token=?,lease_until=?,last_run_at=?
       WHERE id=1 AND interval_minutes>0
         AND (lease_until IS NULL OR lease_until<?)
         AND (last_run_at IS NULL OR last_run_at+interval_minutes*60000<=?)`,
    )
    .run(token, now + 10 * 60_000, now, now, now).changes;
  if (!acquired) return false;
  try {
    const interval = googleAutomationStatus(db).intervalMinutes * 60_000;
    const mappings = db
      .prepare(
        `SELECT m.user_id userId,m.offering_id offeringId
         FROM user_classroom_mappings m
         JOIN users u ON u.id=m.user_id AND u.active=1
         JOIN google_connections_v2 c ON c.user_id=u.id AND c.status='connected'
         JOIN enrollments e ON e.user_id=m.user_id AND e.offering_id=m.offering_id
           AND e.withdrawn_at IS NULL
         JOIN offerings o ON o.id=m.offering_id AND o.archived_at IS NULL
           AND o.state IN ('planned','active')
         LEFT JOIN classroom_sync_v2 s ON s.user_id=m.user_id AND s.offering_id=m.offering_id
         WHERE s.last_success_at IS NULL OR s.last_success_at+?<=?
         ORDER BY s.last_success_at,m.user_id,m.offering_id LIMIT 20`,
      )
      .all(interval, now) as Array<{ userId: number; offeringId: number }>;
    const adapter = new GoogleClassroomAdapter(db);
    for (const { userId, offeringId } of mappings) {
      const result = await syncClassroom(
        db,
        userId,
        offeringId,
        adapter,
        false,
        Date.now(),
        interval,
      );
      if (
        result === "error" &&
        classroomCache(db, userId, offeringId).state.error === "rate_limit"
      )
        break;
    }
    const driveStatus = await checkDriveHealth(db);
    db.prepare(
      `UPDATE google_automation_v2 SET drive_status=?,last_drive_check_at=?
       WHERE id=1 AND lease_token=?`,
    ).run(driveStatus, Date.now(), token);
  } catch {
    db.prepare(
      `UPDATE google_automation_v2 SET drive_status='error',last_drive_check_at=?
       WHERE id=1 AND lease_token=?`,
    ).run(Date.now(), token);
  } finally {
    db.prepare(
      `UPDATE google_automation_v2 SET lease_token=NULL,lease_until=NULL,
       last_finished_at=? WHERE id=1 AND lease_token=?`,
    ).run(Date.now(), token);
  }
  return true;
}
