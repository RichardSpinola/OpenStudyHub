"use client";

import { usePathname } from "next/navigation";
import { useEffect, useId, useRef, type ReactNode } from "react";

export function DismissibleDetails({
  className,
  children,
}: {
  className: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDetailsElement>(null);
  const id = useId();
  const pathname = usePathname();

  useEffect(() => {
    const closeOutside = (event: PointerEvent) => {
      if (ref.current?.open && !ref.current.contains(event.target as Node)) {
        ref.current.open = false;
      }
    };
    const closeEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && ref.current?.open) {
        ref.current.open = false;
        ref.current.querySelector("summary")?.focus();
      }
    };
    const closeOther = (event: Event) => {
      if ((event as CustomEvent<string>).detail !== id && ref.current)
        ref.current.open = false;
    };
    document.addEventListener("pointerdown", closeOutside);
    document.addEventListener("keydown", closeEscape);
    window.addEventListener("osh:popover-open", closeOther);
    return () => {
      document.removeEventListener("pointerdown", closeOutside);
      document.removeEventListener("keydown", closeEscape);
      window.removeEventListener("osh:popover-open", closeOther);
    };
  }, [id]);

  useEffect(() => {
    if (ref.current) ref.current.open = false;
  }, [pathname]);

  return (
    <details
      suppressHydrationWarning
      ref={ref}
      className={className}
      onToggle={(event) => {
        if (event.currentTarget.open)
          window.dispatchEvent(
            new CustomEvent("osh:popover-open", { detail: id }),
          );
      }}
      onClick={(event) => {
        if ((event.target as HTMLElement).closest("a") && ref.current)
          ref.current.open = false;
      }}
    >
      {children}
    </details>
  );
}
