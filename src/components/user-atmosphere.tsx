"use client";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useRef } from "react";
export function UserAtmosphere({ image }: { image: string | null }) {
  const path = usePathname(),
    query = useSearchParams();
  const route =
    path === "/settings"
      ? `${path}?section=${query.get("section") ?? "portal"}`
      : path;
  const lastPath = useRef(route);
  const compatible =
    /^\/(settings|today|subjects|library|extras)(?:\/|$)/.test(path) &&
    // Extras tools stay plain, except the AI assistant, whose panels are frosted over the wallpaper.
    !/^\/extras\/(?!ai(?:\/|$)).+/.test(path);
  useEffect(() => {
    document.documentElement.dataset.wallpaperArea =
      compatible && image ? "true" : "false";
    // Only route changes animate: polling, editor transactions and refreshes do not.
    if (lastPath.current !== route) {
      lastPath.current = route;
      const content = document.getElementById("main-content");
      if (content) content.scrollTop = 0;
      const reduce =
        document.documentElement.dataset.motion === "reduce" ||
        matchMedia("(prefers-reduced-motion: reduce)").matches;
      if (!reduce) {
        const content = document.getElementById("main-content");
        const animation = content?.animate(
          [
            { opacity: 0.75, transform: "translateY(3px)" },
            { opacity: 1, transform: "translateY(0)" },
          ],
          { duration: 170, easing: "ease-out" },
        );
        return () => animation?.cancel();
      }
    }
  }, [route, compatible, image]);
  return image && compatible ? (
    <div
      className="user-wallpaper"
      aria-hidden="true"
      style={{ backgroundImage: `url("${image}")` }}
    />
  ) : null;
}
