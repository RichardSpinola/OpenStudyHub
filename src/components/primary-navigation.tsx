"use client";
import { UiCopy, useUiText } from "@/components/ui-language-provider";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useUiTranslations } from "@/components/ui-language-provider";
import { DismissibleDetails } from "@/components/dismissible-details";
import {
  IconHome,
  IconCalendarWeek,
  IconBooks,
  IconNotes,
  IconFiles,
  IconMessages,
  IconMenu2,
  IconApps,
} from "@tabler/icons-react";

const navigationItems = [
  { href: "/", labelKey: "home", icon: IconHome },
  { href: "/today", labelKey: "today", icon: IconCalendarWeek },
  { href: "/subjects", labelKey: "subjects", icon: IconBooks },
  { href: "/notes", labelKey: "notes", icon: IconNotes },
  { href: "/library", labelKey: "documents", icon: IconFiles },
  { href: "/chat", labelKey: "chat", icon: IconMessages },
] as const;

export function PrimaryNavigation({
  authenticated,
  extrasEnabled,
}: {
  authenticated: boolean;
  projectsEnabled: boolean;
  extrasEnabled: boolean;
}) {
  const pathname = usePathname();
  const tr = useUiText();
  const { navigation } = useUiTranslations();

  if (!authenticated) return null;

  const links = [
    ...navigationItems.map((item) => ({
      href: item.href,
      label:
        item.href === "/library"
          ? tr("Biblioteca", "Library")
          : navigation[item.labelKey],
      icon: item.icon,
    })),
    ...(extrasEnabled
      ? [{ href: "/extras", label: "Extras", icon: IconApps }]
      : []),
  ];
  const renderLinks = () =>
    links.map((item) => {
      const active =
        item.href === "/"
          ? pathname === "/"
          : item.href === "/library"
            ? ["/library", "/documents", "/projects"].some((prefix) =>
                pathname.startsWith(prefix),
              )
            : pathname.startsWith(item.href);
      return (
        <li key={item.href}>
          <Link
            href={item.href}
            aria-label={item.label}
            title={item.label}
            aria-current={active ? "page" : undefined}
          >
            <item.icon size={19} stroke={1.8} aria-hidden="true" />
            <span>{item.label}</span>
          </Link>
        </li>
      );
    });

  return (
    <nav className="primary-nav" aria-label={navigation.label}>
      <ul className="desktop-nav-links">{renderLinks()}</ul>
      <DismissibleDetails className="mobile-nav">
        <summary>
          <IconMenu2 size={22} stroke={1.8} aria-hidden="true" />
          <span>
            <UiCopy pt="Áreas" en="Areas" />
          </span>
        </summary>
        <ul>{renderLinks()}</ul>
      </DismissibleDetails>
    </nav>
  );
}
