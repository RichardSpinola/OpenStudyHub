"use client";
import { UiCopy } from "@/components/ui-language-provider";

import { IconLink } from "@tabler/icons-react";
import { usePopover } from "@/components/use-popover";

import type { ExternalLink } from "@/lib/external-links";

export function ExternalLinksMenu({ links }: { links: ExternalLink[] }) {
  const { open, setOpen, rootRef, triggerRef } = usePopover<HTMLDivElement>();

  if (!links.length) return null;

  return (
    <div className="external-links-menu" ref={rootRef}>
      <button
        ref={triggerRef}
        type="button"
        className="external-links-trigger"
        aria-label="Links externos"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        <IconLink size={19} stroke={1.8} aria-hidden="true" />
      </button>
      {open ? (
        <div className="external-links-popover" role="menu">
          <strong>
            <UiCopy pt="Links externos" en="External links" />
          </strong>
          <ul>
            {links.map((link) => (
              <li key={link.id}>
                <a
                  href={link.url}
                  target={link.newTab ? "_blank" : undefined}
                  rel={link.newTab ? "noreferrer" : undefined}
                  role="menuitem"
                  onClick={() => setOpen(false)}
                >
                  <span>{link.label}</span>
                  {link.newTab ? <span aria-hidden="true">↗</span> : null}
                </a>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
