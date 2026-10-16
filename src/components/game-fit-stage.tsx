"use client";
import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
/** Fit the complete game (including controls and results) to the live workspace. */
export function GameFitStage({ children }: { children: ReactNode }) {
  const viewport = useRef<HTMLDivElement>(null),
    content = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  useLayoutEffect(() => {
    const box = viewport.current,
      inner = content.current;
    if (!box || !inner) return;
    let frame = 0;
    const measure = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const next = Math.min(
          1,
          box.clientWidth / Math.max(1, inner.scrollWidth),
          box.clientHeight / Math.max(1, inner.scrollHeight),
        );
        setScale((previous) =>
          Math.abs(previous - next) > 0.002 ? next : previous,
        );
      });
    };
    const observer = new ResizeObserver(measure);
    observer.observe(box);
    observer.observe(inner);
    const changes = new MutationObserver(measure);
    changes.observe(inner, {
      subtree: true,
      childList: true,
      attributes: true,
      characterData: true,
    });
    measure();
    return () => {
      observer.disconnect();
      changes.disconnect();
      cancelAnimationFrame(frame);
    };
  }, []);
  return (
    <div className="game-fit-stage" ref={viewport}>
      <div
        className="game-fit-content"
        ref={content}
        style={{ transform: `scale(${scale})` }}
      >
        {children}
      </div>
    </div>
  );
}
