import { withV2Db } from "./runtime";

export type PersonalClassroomSummary = {
  connection: "connected" | "needs_reconnect" | "not_connected";
  sync: "updating" | "error" | "ready" | "idle";
  lastSyncAt: number | null;
  updates: Array<{
    id: string;
    offeringId: number;
    title: string;
    subjectName: string;
    publishedAt: string | null;
  }>;
};

export type PersonalClassroomFeedItem = {
  id: string;
  offeringId: number;
  type: "announcement" | "coursework" | "material";
  title: string;
  excerpt: null;
  externalUrl: string | null;
  publishedAt: number | null;
};

export function listPersonalClassroomFeed(
  legacyUserId: number,
  legacyOfferingIds: number[],
): PersonalClassroomFeedItem[] {
  if (
    process.env.OPENSTUDYHUB_V2_ENABLED !== "1" ||
    legacyOfferingIds.length === 0
  )
    return [];
  return withV2Db((db) => {
    const rows = db
      .prepare(
        `SELECT f.external_id id,l.legacy_offering_id offeringId,f.title,
                f.link externalUrl,f.published_at publishedAt
         FROM legacy_user_links u
         JOIN classroom_feed_v2 f ON f.user_id=u.user_id
         JOIN legacy_offering_links l ON l.offering_id=f.offering_id
         JOIN user_classroom_mappings m ON m.user_id=f.user_id AND m.offering_id=f.offering_id
         JOIN enrollments e ON e.user_id=f.user_id AND e.offering_id=f.offering_id
         WHERE u.legacy_user_id=? AND e.withdrawn_at IS NULL
           AND l.legacy_offering_id IN (${legacyOfferingIds.map(() => "?").join(",")})
         ORDER BY f.published_at DESC LIMIT 100`,
      )
      .all(legacyUserId, ...legacyOfferingIds) as Array<{
      id: string;
      offeringId: number;
      title: string;
      externalUrl: string | null;
      publishedAt: string | null;
    }>;
    return rows.map((row) => ({
      ...row,
      type: row.id.startsWith("0:")
        ? "coursework"
        : row.id.startsWith("1:")
          ? "material"
          : "announcement",
      excerpt: null,
      publishedAt: row.publishedAt ? Date.parse(row.publishedAt) || null : null,
    }));
  });
}

// The daily app still projects a V2 user into V1. Resolve the explicit identity
// link; offering IDs in the two schemas must never be treated as equivalent.
export function getPersonalClassroomSummary(
  legacyUserId: number,
): PersonalClassroomSummary | null {
  if (process.env.OPENSTUDYHUB_V2_ENABLED !== "1") return null;
  try {
    return withV2Db((db) => {
      const identity = db
        .prepare(
          "SELECT user_id id FROM legacy_user_links WHERE legacy_user_id=?",
        )
        .get(legacyUserId) as { id: number } | undefined;
      if (!identity) return null;
      const connection = db
        .prepare("SELECT status FROM google_connections_v2 WHERE user_id=?")
        .get(identity.id) as
        { status: "connected" | "needs_reconnect" } | undefined;
      const state = db
        .prepare(
          "SELECT status,last_success_at lastSyncAt FROM classroom_sync_v2 WHERE user_id=? ORDER BY CASE status WHEN 'needs_reconnect' THEN 0 WHEN 'error' THEN 1 WHEN 'updating' THEN 2 WHEN 'ready' THEN 3 ELSE 4 END LIMIT 1",
        )
        .get(identity.id) as
        { status: string; lastSyncAt: number | null } | undefined;
      const updates = db
        .prepare(
          `SELECT f.external_id id,f.offering_id offeringId,f.title,s.name subjectName,f.published_at publishedAt
        FROM classroom_feed_v2 f JOIN offerings o ON o.id=f.offering_id JOIN subjects s ON s.id=o.subject_id
        WHERE f.user_id=? ORDER BY f.published_at DESC LIMIT 4`,
        )
        .all(identity.id) as PersonalClassroomSummary["updates"];
      return {
        connection: connection?.status ?? "not_connected",
        sync:
          state?.status === "updating" ||
          state?.status === "error" ||
          state?.status === "ready"
            ? state.status
            : "idle",
        lastSyncAt: state?.lastSyncAt ?? null,
        updates,
      };
    });
  } catch {
    return null;
  }
}
