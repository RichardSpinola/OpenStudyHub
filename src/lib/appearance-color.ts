export const safeHexColor = /^#[0-9a-fA-F]{6}$/;

function channels(hex: string): [number, number, number] {
  return [1, 3, 5].map((offset) =>
    parseInt(hex.slice(offset, offset + 2), 16),
  ) as [number, number, number];
}

function luminance(hex: string): number {
  const [red, green, blue] = channels(hex).map((channel) => {
    const value = channel / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

export function contrastRatio(first: string, second: string): number {
  const values = [luminance(first), luminance(second)].sort((a, b) => b - a);
  return (values[0] + 0.05) / (values[1] + 0.05);
}

function mix(source: string, target: "#ffffff" | "#000000", fraction: number) {
  const rgb = channels(source).map((channel) =>
    Math.round(
      channel + ((target === "#ffffff" ? 255 : 0) - channel) * fraction,
    ),
  );
  return `#${rgb.map((value) => value.toString(16).padStart(2, "0")).join("")}`;
}

// Preserve the chosen hue as far as possible while keeping accent text readable.
export function accessibleAccent(hex: string, mode: "dark" | "light"): string {
  if (!safeHexColor.test(hex)) throw new Error("Cor hexadecimal inválida.");
  const color = hex.toLowerCase();
  const surface = mode === "dark" ? "#1c1c1c" : "#ffffff";
  if (contrastRatio(color, surface) >= 4.5) return color;
  const target = mode === "dark" ? "#ffffff" : "#000000";
  for (let step = 1; step <= 100; step += 1) {
    const candidate = mix(color, target, step / 100);
    if (contrastRatio(candidate, surface) >= 4.5) return candidate;
  }
  return target;
}
