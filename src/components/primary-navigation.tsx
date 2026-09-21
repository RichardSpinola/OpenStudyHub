"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useUiTranslations } from "@/components/ui-language-provider";

const navigationItems = [
  { href: "/", labelKey: "home", available: true },
  { href: "/today", labelKey: "today", available: true },
  { href: "/subjects", labelKey: "subjects", available: true },
  { href: "/chat", labelKey: "chat", available: true },
] as const;

export function PrimaryNavigation({
  authenticated,
}: {
  authenticated: boolean;
}) {
  const pathname = usePathname();
  const { navigation } = useUiTranslations();

  if (!authenticated) return null;

  return (
    <nav className="primary-nav" aria-label={navigation.label}>
      <ul>
        {navigationItems.map((item) => {
          const label = navigation[item.labelKey];

          if (!item.available) {
            return (
              <li key={item.labelKey}>
                <span aria-disabled="true" title={navigation.future}>
                  {label}
                </span>
              </li>
            );
          }

          const active =
            item.href === "/"
              ? pathname === item.href
              : pathname.startsWith(item.href);

          return (
            <li key={item.href}>
              <Link href={item.href} aria-current={active ? "page" : undefined}>
                {label}
              </Link>
            </li>
          );
        })}
        <li>
          <Link
            href="/settings"
            aria-current={pathname.startsWith("/settings") ? "page" : undefined}
          >
            {navigation.settings}
          </Link>
        </li>
      </ul>
    </nav>
  );
}
