import type { V2Database } from "./database";
import { inspectGoogleV2Config } from "./google-config";
import { storageOwnerStatus } from "./drive-storage";

export function googleOperationalStatus(db: V2Database) {
  const config = inspectGoogleV2Config().diagnostic;
  const storage = storageOwnerStatus(db);
  const users = db
    .prepare(
      `SELECT u.id,u.display_name name,
      CASE WHEN c.status='connected' THEN 1 ELSE 0 END connected,
      CASE WHEN c.status='needs_reconnect' THEN 1 ELSE 0 END needsReconnect,
      (SELECT count(*) FROM enrollments e JOIN offerings o ON o.id=e.offering_id
       WHERE e.user_id=u.id AND e.withdrawn_at IS NULL AND o.archived_at IS NULL
       AND o.state IN ('planned','active')) eligible,
      (SELECT count(*) FROM user_classroom_mappings m
       JOIN enrollments e ON e.user_id=m.user_id AND e.offering_id=m.offering_id
       JOIN offerings o ON o.id=m.offering_id
       WHERE m.user_id=u.id AND e.withdrawn_at IS NULL AND o.archived_at IS NULL
       AND o.state IN ('planned','active')) mapped,
      (SELECT count(*) FROM classroom_sync_v2 s WHERE s.user_id=u.id
       AND s.status IN ('error','needs_reconnect')) syncProblems
     FROM users u LEFT JOIN google_connections_v2 c ON c.user_id=u.id
     WHERE u.active=1 ORDER BY u.display_name,u.id`,
    )
    .all() as Array<{
    id: number;
    name: string;
    connected: number;
    needsReconnect: number;
    eligible: number;
    mapped: number;
    syncProblems: number;
  }>;
  return { config, storage, users };
}
