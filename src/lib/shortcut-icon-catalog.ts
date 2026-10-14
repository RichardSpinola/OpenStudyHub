export const shortcutIconPresets = [
  { id: "drive", label: "Google Drive", hosts: ["drive.google.com"] },
  { id: "class", label: "Google Classroom", hosts: ["classroom.google.com"] },
  { id: "gmail", label: "Gmail", hosts: ["mail.google.com", "gmail.com"] },
  { id: "github", label: "GitHub", hosts: ["github.com", "www.github.com"] },
  {
    id: "youtube",
    label: "YouTube",
    hosts: ["youtube.com", "www.youtube.com", "youtu.be"],
  },
  {
    id: "google",
    label: "Google",
    hosts: ["google.com", "www.google.com", "www.google.com.br"],
  },
  { id: "docs", label: "Google Docs", hosts: ["docs.google.com"] },
  {
    id: "outlook",
    label: "Outlook",
    hosts: ["outlook.live.com", "outlook.office.com"],
  },
  { id: "notion", label: "Notion", hosts: ["notion.so", "www.notion.so"] },
  { id: "discord", label: "Discord", hosts: ["discord.com"] },
  { id: "figma", label: "Figma", hosts: ["figma.com", "www.figma.com"] },
  { id: "gitlab", label: "GitLab", hosts: ["gitlab.com"] },
  { id: "web", label: "Web", hosts: [] },
  { id: "book", label: "Estudos", hosts: [] },
  { id: "code", label: "Código", hosts: [] },
] as const;
export type ShortcutIconPreset = (typeof shortcutIconPresets)[number]["id"];
export function shortcutPresetFor(
  url: string,
  icon: string | null,
): ShortcutIconPreset | null {
  if (icon === "@site" || icon === "@text") return null;
  const selected = shortcutIconPresets.find((p) => `@${p.id}` === icon);
  if (selected) return selected.id;
  try {
    const host = new URL(url).hostname.toLowerCase();
    return (
      shortcutIconPresets.find((p) =>
        (p.hosts as readonly string[]).includes(host),
      )?.id ?? null
    );
  } catch {
    return null;
  }
}
