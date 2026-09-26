"use client";

import { useEffect, useRef, useState } from "react";

type LogoLayout = { variant: "full" | "compact" | "framed"; fontSize: number };

export function chooseAsciiLogoLayout(
  availableWidth: number,
  fullWidth: number,
  compactWidth: number,
): LogoLayout {
  const width = Math.max(0, availableWidth - 8);
  const fullSize = Math.min(14, Math.floor((width / fullWidth) * 16));
  if (fullSize >= 10) return { variant: "full", fontSize: fullSize };
  const compactSize = Math.min(14, Math.floor((width / compactWidth) * 16));
  if (compactSize >= 10) return { variant: "compact", fontSize: compactSize };
  return { variant: "framed", fontSize: 12 };
}

export function AsciiLogo({
  value,
  compactValue,
  label = "OpenStudyHub",
  responsive = false,
}: {
  value: string;
  compactValue?: string;
  label?: string;
  responsive?: boolean;
}) {
  const preRef = useRef<HTMLPreElement>(null);
  const [layout, setLayout] = useState<LogoLayout>({
    variant: "full",
    fontSize: 12,
  });

  useEffect(() => {
    if (!responsive || !compactValue || !preRef.current) return;
    const element = preRef.current;
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");
    if (!context) return;
    context.font = "700 16px monospace";
    const measure = (text: string) =>
      Math.max(
        ...text.split("\n").map((line) => context.measureText(line).width),
      );
    const fullWidth = measure(value);
    const compactWidth = measure(compactValue);
    const observer = new ResizeObserver(() => {
      const next = chooseAsciiLogoLayout(
        element.clientWidth,
        fullWidth,
        compactWidth,
      );
      setLayout((current) =>
        current.variant === next.variant && current.fontSize === next.fontSize
          ? current
          : next,
      );
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [responsive, value, compactValue]);

  const content =
    responsive && layout.variant === "framed"
      ? `[ ${label} ]`
      : responsive && layout.variant === "compact"
        ? compactValue
        : value;

  return (
    <pre
      ref={preRef}
      className="ascii-logo"
      aria-label={label}
      data-logo-variant={responsive ? layout.variant : undefined}
      style={responsive ? { fontSize: `${layout.fontSize}px` } : undefined}
    >
      {content}
    </pre>
  );
}
