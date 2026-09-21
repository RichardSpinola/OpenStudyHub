"use client";

import { useEffect, useRef, useState } from "react";

import type { ExternalLink } from "@/lib/external-links";

export function ExternalLinksMenu({ links }: { links: ExternalLink[] }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const closeOnOutsideClick = (event: MouseEvent) => {
      const target = event.target;
      if (target instanceof Node && !rootRef.current?.contains(target)) {
        setOpen(false);
      }
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("mousedown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  if (!links.length) return null;

  return (
    <div className="external-links-menu" ref={rootRef}>
      <button
        type="button"
        className="external-links-trigger"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        LINKS {links.length}
      </button>
      {open ? (
        <div className="external-links-popover" role="menu">
          <strong>Links externos</strong>
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
