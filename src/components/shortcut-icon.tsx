import {
  IconBrandGoogleDrive,
  IconBrandGmail,
  IconBrandGithub,
  IconChalkboardTeacher,
  IconBrandYoutube,
  IconBrandGoogle,
  IconFileText,
  IconBrandOffice,
  IconBrandNotion,
  IconBrandDiscord,
  IconBrandFigma,
  IconBrandGitlab,
  IconWorld,
  IconBook,
  IconCode,
} from "@tabler/icons-react";
import type { ShortcutIconPreset } from "@/lib/shortcut-icon-catalog";
const icons = {
  drive: IconBrandGoogleDrive,
  gmail: IconBrandGmail,
  github: IconBrandGithub,
  class: IconChalkboardTeacher,
  youtube: IconBrandYoutube,
  google: IconBrandGoogle,
  docs: IconFileText,
  outlook: IconBrandOffice,
  notion: IconBrandNotion,
  discord: IconBrandDiscord,
  figma: IconBrandFigma,
  gitlab: IconBrandGitlab,
  web: IconWorld,
  book: IconBook,
  code: IconCode,
};
export function ShortcutPresetIcon({
  preset,
  size = 28,
}: {
  preset: ShortcutIconPreset;
  size?: number;
}) {
  const Icon = icons[preset];
  return <Icon size={size} stroke={1.6} aria-hidden="true" />;
}
