import type { V2Database } from "./database";

export const extraKeys = [
  "extras",
  "whiteboard",
  "games",
  "snake",
  "2048",
  "minesweeper",
  "solitaire",
  "domino",
] as const;
export type ExtraKey = (typeof extraKeys)[number];
export type ExtrasFlags = Record<ExtraKey, boolean>;

export function getExtrasFlags(db: V2Database): ExtrasFlags {
  const flags: ExtrasFlags = {
    extras: false,
    whiteboard: false,
    games: false,
    snake: false,
    "2048": false,
    minesweeper: false,
    solitaire: false,
    domino: false,
  };
  const rows = db
    .prepare("SELECT key,enabled FROM extras_settings_v2")
    .all() as Array<{ key: string; enabled: number }>;
  for (const row of rows) {
    if (extraKeys.includes(row.key as ExtraKey))
      flags[row.key as ExtraKey] = row.enabled === 1;
  }
  return flags;
}

export function extraAccessible(flags: ExtrasFlags, key: ExtraKey): boolean {
  if (!flags.extras) return false;
  if (key === "extras") return true;
  if (key === "whiteboard" || key === "games") return flags[key];
  return flags.games && flags[key];
}

export function updateExtrasFlags(db: V2Database, flags: ExtrasFlags): void {
  const statement = db.prepare(
    "UPDATE extras_settings_v2 SET enabled=? WHERE key=?",
  );
  db.transaction(() => {
    for (const key of extraKeys) statement.run(flags[key] ? 1 : 0, key);
  })();
}
