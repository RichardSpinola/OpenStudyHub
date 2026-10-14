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
