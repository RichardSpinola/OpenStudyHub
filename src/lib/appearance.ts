import { z } from "zod";
import { withV2Db } from "@/lib/v2/runtime";
import type { V2Database } from "@/lib/v2/database";
import { safeHexColor } from "@/lib/appearance-color";

export const appearanceSchema = z.object({
  theme: z.enum(["material", "legacy"]),
  mode: z.enum(["dark", "light", "system"]),
  density: z.enum(["comfortable", "compact"]),
  accent: z.enum([
    "neutral",
    "green",
    "blue",
    "red",
    "purple",
    "amber",
    "custom",
  ]),
  customAccent: z.string().regex(safeHexColor),
  navigationLayout: z.enum(["top", "classic"]),
  searchEngine: z.enum([
    "google",
    "scholar",
    "duckduckgo",
    "startpage",
    "ecosia",
  ]),
  motion: z.enum(["system", "reduce"]),
  contrast: z.enum(["system", "high"]),
});
export type Appearance = z.infer<typeof appearanceSchema>;
export const defaultAppearance: Appearance = {
  theme: "material",
  mode: "dark",
  density: "comfortable",
  accent: "neutral",
  customAccent: "#6e7680",
  navigationLayout: "top",
  searchEngine: "google",
  motion: "system",
  contrast: "system",
};

function canonicalId(db: V2Database, legacyUserId: number): number | null {
  const row = db
    .prepare("SELECT user_id id FROM legacy_user_links WHERE legacy_user_id=?")
    .get(legacyUserId) as { id: number } | undefined;
  return row?.id ?? null;
}

export function getAppearance(legacyUserId: number): Appearance {
  if (process.env.OPENSTUDYHUB_V2_ENABLED !== "1")
    return { ...defaultAppearance, theme: "legacy" };
  return withV2Db((db) => {
    const id = canonicalId(db, legacyUserId);
    if (id === null) return defaultAppearance;
    return getAppearanceFromDb(db, id);
  });
}

export function getAppearanceFromDb(
  db: V2Database,
  canonicalUserId: number,
): Appearance {
  const row = db
    .prepare(
      "SELECT theme,mode,density,accent,custom_accent customAccent,navigation_layout navigationLayout,search_engine searchEngine,motion,contrast FROM user_appearance WHERE user_id=?",
    )
    .get(canonicalUserId);
  const stored = row as (Record<string, unknown> & { theme?: string }) | undefined;
  return appearanceSchema.catch(defaultAppearance).parse(
    stored?.theme === "custom" ? { ...stored, theme: "material" } : (stored ?? defaultAppearance),
  );
}

export function saveAppearanceToDb(
  db: V2Database,
  canonicalUserId: number,
  input: unknown,
): Appearance {
  const appearance = appearanceSchema.parse(input);
  db.prepare(
    `INSERT INTO user_appearance(user_id,theme,mode,density,accent,custom_accent,navigation_layout,search_engine,motion,contrast,updated_at)
    VALUES(?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(user_id) DO UPDATE SET theme=excluded.theme,mode=excluded.mode,
    density=excluded.density,accent=excluded.accent,custom_accent=excluded.custom_accent,
    navigation_layout=excluded.navigation_layout,
    search_engine=excluded.search_engine,motion=excluded.motion,contrast=excluded.contrast,updated_at=excluded.updated_at`,
  ).run(
    canonicalUserId,
    appearance.theme,
    appearance.mode,
    appearance.density,
    appearance.accent,
    appearance.customAccent,
    appearance.navigationLayout,
    appearance.searchEngine,
    appearance.motion,
    appearance.contrast,
    Date.now(),
  );
  return appearance;
}

export function updateAppearance(
  legacyUserId: number,
  input: unknown,
): Appearance {
  const appearance = appearanceSchema.parse(input);
  if (process.env.OPENSTUDYHUB_V2_ENABLED !== "1") return appearance;
  withV2Db((db) => {
    const id = canonicalId(db, legacyUserId);
    if (id === null) throw new Error("Identidade V2 não vinculada.");
    saveAppearanceToDb(db, id, appearance);
  });
  return appearance;
}
