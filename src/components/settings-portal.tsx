import Link from "next/link";
import {
  IconUser,
  IconPalette,
  IconHome,
  IconBell,
  IconPlug,
  IconAccessible,
  IconHelp,
  IconInfoCircle,
  IconArrowRight,
} from "@tabler/icons-react";
import { UiCopy } from "./ui-language-provider";
export const settingsGroups = [
  [
    "profile",
    IconUser,
    "Conta e perfil",
    "Account and profile",
    "Sua foto, apresentação e privacidade.",
    "Your photo, introduction and privacy.",
  ],
  [
    "personalization",
    IconPalette,
    "Aparência",
    "Appearance",
    "Tema, cores, navegação e efeitos visuais.",
    "Theme, colors, navigation and visual effects.",
  ],
  [
    "home",
    IconHome,
    "Home e atalhos",
    "Home and shortcuts",
    "Wallpaper, relógio, busca e seus links.",
    "Wallpaper, clock, search and your links.",
  ],
  [
    "notifications",
    IconBell,
    "Notificações",
    "Notifications",
    "O que receber e em quais dispositivos.",
    "What to receive and on which devices.",
  ],
  [
    "google",
    IconPlug,
    "Integrações",
    "Integrations",
    "Sua conexão com Google e Classroom.",
    "Your connection to Google and Classroom.",
  ],
  [
    "accessibility",
    IconAccessible,
    "Acessibilidade e idioma",
    "Accessibility and language",
    "Movimento, contraste e idioma de leitura.",
    "Motion, contrast and reading language.",
  ],
  [
    "help",
    IconHelp,
    "Ajuda",
    "Help",
    "Guias práticos para usar seu espaço.",
    "Practical guides for your workspace.",
  ],
  [
    "about",
    IconInfoCircle,
    "Sobre e Créditos",
    "About and Credits",
    "Versão, licenças e quem faz parte.",
    "Version, licenses and contributors.",
  ],
] as const;
export function SettingsPortal() {
  return (
    <div className="settings-portal">
      {settingsGroups.map(([section, Icon, pt, en, description, english]) => (
        <Link
          className="settings-category"
          key={section}
          href={`/settings?section=${section}`}
        >
          <div
            className={`settings-illustration settings-illustration-${section}`}
            aria-hidden="true"
          >
            <span className="settings-mini-panel">
              <i />
              <i />
              <i />
            </span>
            <Icon size={38} stroke={1.5} />
          </div>
          <div className="settings-category-copy">
            <h2>
              <UiCopy pt={pt} en={en} />
            </h2>
            <p>
              <UiCopy pt={description} en={english} />
            </p>
          </div>
          <IconArrowRight size={19} aria-hidden="true" />
        </Link>
      ))}
    </div>
  );
}
