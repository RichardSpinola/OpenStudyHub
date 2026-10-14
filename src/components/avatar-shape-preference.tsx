"use client";
import { useEffect, useSyncExternalStore } from "react";
import { UiCopy, useUiText } from "./ui-language-provider";
type Shape = "theme" | "round" | "square";
const key = "openstudyhub.avatar-shape";
function read(): Shape {
  try {
    const value = localStorage.getItem(key);
    return value === "round" || value === "square" ? value : "theme";
  } catch {
    return "theme";
  }
}
function apply() {
  const shape = read();
  if (shape === "theme") delete document.documentElement.dataset.avatarShape;
  else document.documentElement.dataset.avatarShape = shape;
}
export function AvatarShapeBridge() {
  useEffect(() => {
    apply();
    window.addEventListener("storage", apply);
    window.addEventListener("openstudyhub:avatar-shape", apply);
    return () => {
      window.removeEventListener("storage", apply);
      window.removeEventListener("openstudyhub:avatar-shape", apply);
    };
  }, []);
  return null;
}
function subscribe(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener("openstudyhub:avatar-shape", callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener("openstudyhub:avatar-shape", callback);
  };
}
export function AvatarShapePreference() {
  const shape = useSyncExternalStore(subscribe, read, () => "theme");
  const tr = useUiText();
  return (
    <fieldset className="avatar-shape-preference">
      <legend>
        <UiCopy
          pt="Formato do avatar neste navegador"
          en="Avatar shape in this browser"
        />
      </legend>
      <label>
        <UiCopy pt="Formato" en="Shape" />
        <select
          value={shape}
          onChange={(event) => {
            const value = event.target.value as Shape;
            try {
              localStorage.setItem(key, value);
            } catch {
              /* Device storage may be unavailable. */
            }
            window.dispatchEvent(new Event("openstudyhub:avatar-shape"));
          }}
        >
          <option value="theme">{tr("Padrão do tema", "Theme default")}</option>
          <option value="round">{tr("Redondo", "Round")}</option>
          <option value="square">{tr("Quadrado", "Square")}</option>
        </select>
      </label>
    </fieldset>
  );
}
