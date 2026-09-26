import type { V2Database } from "./database";
import { googleAccessTokenV2 } from "./google-oauth";

export type GoogleHealthResult =
  "pending" | "ready" | "temporary_error" | "needs_reconnect";
export function googleHealthStatus(db: V2Database, userId: number) {
  const connection = db
    .prepare(
      "SELECT status,updated_at incidentAt FROM google_connections_v2 WHERE user_id=?",
    )
    .get(userId) as
    { status: "connected" | "needs_reconnect"; incidentAt: number } | undefined;
  const health = db
    .prepare(
      "SELECT checked_at checkedAt,result,dismissed_incident_at dismissedIncidentAt FROM google_connection_health_v2 WHERE user_id=?",
    )
    .get(userId) as
    | {
        checkedAt: number | null;
        result: GoogleHealthResult;
        dismissedIncidentAt: number | null;
      }
    | undefined;
  return {
    connection: connection?.status ?? "not_connected",
    checkedAt: health?.checkedAt ?? null,
    result: health?.result ?? "pending",
    incidentAt:
      connection?.status === "needs_reconnect" ? connection.incidentAt : null,
    attention:
      connection?.status === "needs_reconnect" &&
      health?.dismissedIncidentAt !== connection.incidentAt,
  };
}
export function dismissGoogleHealthIncident(
  db: V2Database,
  userId: number,
): void {
  const status = googleHealthStatus(db, userId);
  if (status.incidentAt === null) return;
  db.prepare(
    `INSERT INTO google_connection_health_v2(user_id,result,dismissed_incident_at) VALUES(?,'needs_reconnect',?)
    ON CONFLICT(user_id) DO UPDATE SET dismissed_incident_at=excluded.dismissed_incident_at`,
  ).run(userId, status.incidentAt);
}
export async function runGoogleHealthChecks(
  db: V2Database,
  now = Date.now(),
  accessToken = googleAccessTokenV2,
): Promise<number> {
  const rows = db
    .prepare(
      `SELECT c.user_id userId FROM google_connections_v2 c
    LEFT JOIN google_connection_health_v2 h ON h.user_id=c.user_id
    JOIN users u ON u.id=c.user_id AND u.active=1
    WHERE c.status='connected' AND (h.checked_at IS NULL OR h.checked_at+3600000<=?)
    ORDER BY h.checked_at LIMIT 10`,
    )
    .all(now) as Array<{ userId: number }>;
  for (const { userId } of rows) {
    await checkGoogleHealthForUser(db, userId, now, accessToken);
  }
  return rows.length;
}

export async function checkGoogleHealthForUser(
  db: V2Database,
  userId: number,
  now = Date.now(),
  accessToken = googleAccessTokenV2,
): Promise<boolean> {
  const connection = db
    .prepare("SELECT status FROM google_connections_v2 WHERE user_id=?")
    .get(userId) as { status: string } | undefined;
  if (connection?.status !== "connected") return false;
  const claimed = db
    .prepare(
      `INSERT INTO google_connection_health_v2(user_id,checked_at,result) VALUES(?,?,'pending')
    ON CONFLICT(user_id) DO UPDATE SET checked_at=excluded.checked_at,result='pending'
    WHERE google_connection_health_v2.checked_at IS NULL OR google_connection_health_v2.checked_at+3600000<=excluded.checked_at`,
    )
    .run(userId, now).changes;
  if (!claimed) return false;
  let result: GoogleHealthResult = "ready";
  try {
    await accessToken(db, userId);
  } catch {
    const current = db
      .prepare("SELECT status FROM google_connections_v2 WHERE user_id=?")
      .get(userId) as { status: string } | undefined;
    result =
      current?.status === "needs_reconnect"
        ? "needs_reconnect"
        : "temporary_error";
  }
  db.prepare(
    "UPDATE google_connection_health_v2 SET result=? WHERE user_id=? AND checked_at=?",
  ).run(result, userId, now);
  return true;
}
