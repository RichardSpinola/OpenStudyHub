import { z } from "zod";
import { figletFontOptions } from "./ascii-fonts";
import { withV2Db } from "./v2/runtime-database";
import type { V2Database } from "./v2/database";

export const homePresentationSchema = z
  .object({
    asciiFont: z.enum(figletFontOptions).nullable().default(null),
    wallpaperX: z.coerce.number().int().min(0).max(100).default(50),
    wallpaperY: z.coerce.number().int().min(0).max(100).default(50),
    wallpaperFit: z.enum(["cover", "contain"]).default("cover"),
  })
  .strict();
export type HomePresentation = z.infer<typeof homePresentationSchema>;
export const defaultHomePresentation: HomePresentation =
  homePresentationSchema.parse({});

export function readHomePresentation(
  db: V2Database,
  userId: number,
): HomePresentation {
  const row = db
    .prepare(
      `SELECT ascii_font asciiFont, wallpaper_x wallpaperX,
    wallpaper_y wallpaperY, wallpaper_fit wallpaperFit FROM user_home_presentation WHERE user_id=?`,
    )
    .get(userId);
  return homePresentationSchema.catch(defaultHomePresentation).parse(row ?? {});
}
export function writeHomePresentation(
  db: V2Database,
  userId: number,
  input: unknown,
): HomePresentation {
  const value = homePresentationSchema.parse(input);
  db.prepare(
    `INSERT INTO user_home_presentation(user_id,ascii_font,wallpaper_x,wallpaper_y,wallpaper_fit,updated_at)
    VALUES(?,?,?,?,?,?) ON CONFLICT(user_id) DO UPDATE SET ascii_font=excluded.ascii_font,
    wallpaper_x=excluded.wallpaper_x, wallpaper_y=excluded.wallpaper_y, wallpaper_fit=excluded.wallpaper_fit,updated_at=excluded.updated_at`,
  ).run(
    userId,
    value.asciiFont,
    value.wallpaperX,
    value.wallpaperY,
    value.wallpaperFit,
    Date.now(),
  );
  return value;
}
function canonicalId(db: V2Database, legacyUserId: number) {
  const row = db
    .prepare("SELECT user_id id FROM legacy_user_links WHERE legacy_user_id=?")
    .get(legacyUserId) as { id: number } | undefined;
  if (!row) throw new Error("Identidade V2 não vinculada.");
  return row.id;
}
export function getHomePresentation(legacyUserId: number): HomePresentation {
  if (process.env.OPENSTUDYHUB_V2_ENABLED !== "1")
    return defaultHomePresentation;
  return withV2Db((db) =>
    readHomePresentation(db, canonicalId(db, legacyUserId)),
  );
}
export function saveHomePresentation(legacyUserId: number, value: unknown) {
  return withV2Db((db) =>
    writeHomePresentation(db, canonicalId(db, legacyUserId), value),
  );
}
