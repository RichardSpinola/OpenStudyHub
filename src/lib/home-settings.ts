import type { DatabaseConnection } from "@/lib/db/client";
import { getDatabase } from "@/lib/db/client";
import figlet, { type FontName } from "figlet";
import { z } from "zod";

const BRAND_TEXT_KEY = "home.brand_text";
const BRAND_FONT_KEY = "home.brand_figlet_font";

figlet.defaults({ fetchFontIfMissing: false });

export const figletFontOptions = [
  "ANSI Shadow",
  "Digital",
  "Future Thin",
  "Rectangles",
  "Small",
  "Small Slant",
  "Standard",
  "Thin",
  "Three Point",
] as const;

export type BrandFigletFont = (typeof figletFontOptions)[number];

export type BrandConfig = {
  text: string;
  font: BrandFigletFont;
};

export const defaultBrandConfig: BrandConfig = {
  text: "OpenStudyHub",
  font: "ANSI Shadow",
};

export const brandTextSchema = z
  .string()
  .trim()
  .min(1, "O texto da marca não pode ficar vazio.")
  .max(20, "O texto da marca deve ter no máximo 20 caracteres.")
  .refine(
    (value) => /^[a-z0-9 ._-]+$/iu.test(value),
    "O texto da marca contém caracteres incompatíveis.",
  );

export const brandFigletFontSchema = z.enum(figletFontOptions);

export function generateAsciiLogo(config: BrandConfig): string {
  const text = brandTextSchema.parse(config.text);
  const font = brandFigletFontSchema.parse(config.font);
  const output = figlet.textSync(text, {
    font: font as FontName,
    horizontalLayout: "fitted",
  });
  const normalizedOutput = output.trimEnd();
  const lines = normalizedOutput.split("\n");
  const maxColumns = Math.max(...lines.map((line) => line.length));

  if (lines.length > 12 || maxColumns > 120) {
    throw new Error("A marca gerada excede os limites de exibição.");
  }

  return normalizedOutput;
}

export function getBrandConfig(
  connection: DatabaseConnection = getDatabase(),
): BrandConfig {
  const rows = connection.sqlite
    .prepare("select key, value from app_settings where key in (?, ?)")
    .all(BRAND_TEXT_KEY, BRAND_FONT_KEY) as Array<{
    key: string;
    value: string;
  }>;
  const settings = new Map(rows.map(({ key, value }) => [key, value]));
  const textResult = brandTextSchema.safeParse(settings.get(BRAND_TEXT_KEY));
  const fontResult = brandFigletFontSchema.safeParse(
    settings.get(BRAND_FONT_KEY),
  );

  return {
    text: textResult.success ? textResult.data : defaultBrandConfig.text,
    font: fontResult.success ? fontResult.data : defaultBrandConfig.font,
  };
}

export function getAsciiLogo(
  connection: DatabaseConnection = getDatabase(),
): string {
  return generateAsciiLogo(getBrandConfig(connection));
}

export function updateBrandConfig(
  input: BrandConfig,
  connection: DatabaseConnection = getDatabase(),
): BrandConfig {
  const config = {
    text: brandTextSchema.parse(input.text),
    font: brandFigletFontSchema.parse(input.font),
  };
  generateAsciiLogo(config);
  const now = Date.now();
  const upsert = connection.sqlite.prepare(
    `insert into app_settings (key, value, updated_at)
     values (?, ?, ?)
     on conflict(key) do update set value = excluded.value, updated_at = excluded.updated_at`,
  );

  connection.sqlite.transaction(() => {
    upsert.run(BRAND_TEXT_KEY, config.text, now);
    upsert.run(BRAND_FONT_KEY, config.font, now);
  })();

  return config;
}
