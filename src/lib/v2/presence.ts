import type { V2Database } from "./database";

export function presenceSummary(db: V2Database, now = Date.now()) {
  const online = (
    db
      .prepare(
        "SELECT count(DISTINCT user_id) n FROM realtime_connections WHERE last_heartbeat_at>=?",
      )
      .get(now - 45_000) as { n: number }
  ).n;
  const active = (minutes: number) =>
    (
      db
        .prepare(
          "SELECT count(*) n FROM user_presence_seen WHERE last_seen_at>=?",
        )
        .get(now - minutes * 60_000) as { n: number }
    ).n;
  return {
    online,
    last15Minutes: active(15),
    lastHour: active(60),
    lastDay: active(1440),
    lastWeek: active(10080),
  };
}
