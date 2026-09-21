"use client";

import { useEffect, useState } from "react";

export function HomeClock({
  locale,
  position,
}: {
  locale: string;
  position: "top-left" | "top-right" | "bottom-left" | "bottom-right";
}) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(timer);
  }, []);
  const time = new Intl.DateTimeFormat(locale, {
    hour: "2-digit",
    minute: "2-digit",
  }).format(now);
  const date = new Intl.DateTimeFormat(locale, {
    day: "2-digit",
    month: "short",
  })
    .format(now)
    .replace(".", "")
    .toUpperCase();
  return (
    <time
      className="home-clock"
      data-position={position}
      dateTime={now.toISOString()}
      suppressHydrationWarning
    >
      <strong>{time}</strong>
      <span>{date}</span>
    </time>
  );
}
