"use client";

import { usePathname } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";

export function usePopover<T extends HTMLElement>() {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<T>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const id = useId();
  const pathname = usePathname();

  useEffect(() => {
    if (!open) return;
    window.dispatchEvent(new CustomEvent("osh:popover-open", { detail: id }));
    const outside = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    const other = (event: Event) => {
      if ((event as CustomEvent<string>).detail !== id) setOpen(false);
    };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    window.addEventListener("osh:popover-open", other);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", escape);
      window.removeEventListener("osh:popover-open", other);
    };
  }, [open, id]);

  useEffect(() => {
    const timer = window.setTimeout(() => setOpen(false), 0);
    return () => window.clearTimeout(timer);
  }, [pathname]);

  return { open, setOpen, rootRef, triggerRef };
}
