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
  IconDots,
} from "@tabler/icons-react";

const navigationItems = [
  { href: "/", labelKey: "home", icon: IconHome },
  { href: "/today", labelKey: "today", icon: IconCalendarWeek },
  { href: "/subjects", labelKey: "subjects", icon: IconBooks },
  { href: "/notes", labelKey: "notes", icon: IconNotes },
  { href: "/library", labelKey: "documents", icon: IconFiles },
  { href: "/chat", labelKey: "chat", icon: IconMessages },
] as const;

function useNavigationLinks(extrasEnabled: boolean, examMode: boolean) {
  const pathname = usePathname();
  const tr = useUiText();
  const { navigation } = useUiTranslations();
  const links = [
    ...navigationItems
      .filter(
        (item) => !examMode || ["/", "/today", "/subjects"].includes(item.href),
      )
      .map((item) => ({
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
  const isActive = (href: string) =>
    href === "/"
      ? pathname === "/"
      : href === "/library"
        ? ["/library", "/documents", "/projects"].some((prefix) =>
            pathname.startsWith(prefix),
          )
        : pathname.startsWith(href);
  return { links, isActive, label: navigation.label, tr };
}

export function PrimaryNavigation({
  authenticated,
  extrasEnabled,
  examMode = false,
}: {
  authenticated: boolean;
  projectsEnabled: boolean;
  extrasEnabled: boolean;
  examMode?: boolean;
}) {
  const { links, isActive, label } = useNavigationLinks(
    extrasEnabled,
    examMode,
  );
  if (!authenticated) return null;
  const renderLinks = () =>
    links.map((item) => {
      const active = isActive(item.href);
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
    <nav className="primary-nav" aria-label={label}>
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

/** Phone navigation: the main areas stay one tap away at the bottom of the screen. */
export function MobileTabBar({
  extrasEnabled,
  examMode = false,
}: {
  extrasEnabled: boolean;
  examMode?: boolean;
}) {
  const { links, isActive, label, tr } = useNavigationLinks(
    extrasEnabled,
    examMode,
  );
  const primary = links.filter((item) =>
    ["/", "/today", "/subjects", "/notes", "/chat"].includes(item.href),
  );
  const more = links.filter((item) => !primary.includes(item));
  return (
    <nav className="mobile-tabbar" aria-label={label}>
      {primary.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          aria-current={isActive(item.href) ? "page" : undefined}
        >
          <item.icon size={22} stroke={1.8} aria-hidden="true" />
          <span>{item.label}</span>
        </Link>
      ))}
      {more.length > 0 && (
        <DismissibleDetails className="mobile-tabbar-more">
          <summary
            data-active={more.some((item) => isActive(item.href)) || undefined}
          >
            <IconDots size={22} stroke={1.8} aria-hidden="true" />
            <span>{tr("Mais", "More")}</span>
          </summary>
          <div>
            {more.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                aria-current={isActive(item.href) ? "page" : undefined}
              >
                <item.icon size={20} stroke={1.8} aria-hidden="true" />
                {item.label}
              </Link>
            ))}
          </div>
        </DismissibleDetails>
      )}
    </nav>
  );
}
