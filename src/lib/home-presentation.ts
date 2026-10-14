import { z } from "zod";
import { figletFontOptions } from "./ascii-fonts";
import { withV2Db } from "./v2/runtime-database";
import type { V2Database } from "./v2/database";

export const homePresentationSchema = z
  .object({
    asciiFont: z.enum(figletFontOptions).nullable().default(null),
    wallpaperX: z.coerce.number().int().min(0).max(100).default(50),
    wallpaperY: z.coerce.number().int().min(0).max(100).default(50),
    wallpaperZoom: z.coerce.number().min(1).max(3).default(1),
    wallpaperFit: z.enum(["cover", "contain"]).default("cover"),
    controlEnabled: z.boolean().default(true),
    controlX: z.number().min(0).max(100).nullable().default(null),
    controlY: z.number().min(0).max(100).nullable().default(null),
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
    wallpaper_y wallpaperY, wallpaper_fit wallpaperFit, wallpaper_zoom wallpaperZoom, control_enabled controlEnabled, control_x controlX, control_y controlY FROM user_home_presentation WHERE user_id=?`,
    )
    .get(userId);
  return homePresentationSchema.catch(defaultHomePresentation).parse(
    row
      ? {
          ...row,
          controlEnabled: Boolean(
            (row as { controlEnabled: number }).controlEnabled,
          ),
        }
      : {},
  );
}
export function writeHomePresentation(
  db: V2Database,
  userId: number,
  input: unknown,
): HomePresentation {
  const value = homePresentationSchema.parse(input);
  db.prepare(
    `INSERT INTO user_home_presentation(user_id,ascii_font,wallpaper_x,wallpaper_y,wallpaper_fit,wallpaper_zoom,control_enabled,control_x,control_y,updated_at)
    VALUES(?,?,?,?,?,?,?,?,?,?) ON CONFLICT(user_id) DO UPDATE SET ascii_font=excluded.ascii_font,
    wallpaper_x=excluded.wallpaper_x, wallpaper_y=excluded.wallpaper_y, wallpaper_fit=excluded.wallpaper_fit,wallpaper_zoom=excluded.wallpaper_zoom,control_enabled=excluded.control_enabled,control_x=excluded.control_x,control_y=excluded.control_y,updated_at=excluded.updated_at`,
  ).run(
    userId,
    value.asciiFont,
    value.wallpaperX,
    value.wallpaperY,
    value.wallpaperFit,
    value.wallpaperZoom,
    Number(value.controlEnabled),
    value.controlX,
    value.controlY,
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
