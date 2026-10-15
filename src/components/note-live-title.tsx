"use client";
import { useEffect, useState } from "react";
export function NoteLiveTitle({ id, title }: { id: number; title: string }) {
  const [value, setValue] = useState(title);
  useEffect(() => {
    const listener = (event: Event) => {
      const v = (event as CustomEvent<{ id: number; title: string }>).detail;
      if (v?.id === id) setValue(v.title);
    };
    window.addEventListener("osh:note-title", listener);
    return () => window.removeEventListener("osh:note-title", listener);
  }, [id]);
  return <span>{value}</span>;
}
