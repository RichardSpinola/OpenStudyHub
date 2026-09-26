"use client";
import { UiCopy, useUiText } from "@/components/ui-language-provider";


import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { saveAppearanceSelectionAction } from "@/app/settings/actions";
import type { Appearance } from "@/lib/appearance";
import { accessibleAccent } from "@/lib/appearance-color";

export function AppearanceControls({ initial }: { initial: Appearance }) {
  const tr = useUiText();
  const [value, setValue] = useState(initial);
  const router = useRouter();
  const [status, setStatus] = useState("");
  const first = useRef(true);
  const lastSaved = useRef(initial);
  const queue = useRef(Promise.resolve());
  useEffect(() => {
    const root = document.documentElement;
    root.dataset.design = value.theme;
    root.dataset.theme = value.mode;
    root.dataset.density = value.density;
    root.dataset.accent = value.accent;
    root.dataset.navLayout = value.navigationLayout;
    if (value.accent === "custom") {
      root.style.setProperty(
        "--custom-accent-dark",
        accessibleAccent(value.customAccent, "dark"),
      );
      root.style.setProperty(
        "--custom-accent-light",
        accessibleAccent(value.customAccent, "light"),
      );
    }
  }, [value]);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    setStatus(tr("Salvando aparência…", "Saving appearance…"));
    const timer = window.setTimeout(() => {
      queue.current = queue.current.then(async () => {
        try {
          await saveAppearanceSelectionAction(value);
          lastSaved.current = value;
          setStatus(tr("Aparência salva.", "Appearance saved."));
          router.refresh();
        } catch {
          setValue(lastSaved.current);
          setStatus(tr("Não foi possível salvar. Tente novamente.", "Could not save. Try again."));
        }
      });
    }, 350);
    return () => window.clearTimeout(timer);
  }, [router, tr, value]);
  function change<K extends keyof Appearance>(key: K, next: Appearance[K]) {
    setValue((current) => ({
      ...current,
      [key]: next,
    }));
  }
  return (
    <div className="appearance-controls appearance-visual-controls">
      <fieldset className="appearance-choice-grid">
        <legend><UiCopy pt="Visual do aplicativo" en="App appearance" /></legend>
        {(
          [
            ["material", "Material", "Superfícies suaves e navegação clara"],
            ["legacy", "Legacy / TUI", "Identidade clássica do OpenStudyHub"],
          ] as const
        ).map(([id, label, description]) => (
          <label key={id} data-selected={value.theme === id}>
            <input
              type="radio"
              name="designTheme"
              value={id}
              checked={value.theme === id}
              onChange={() => change("theme", id)}
            />
            <span
              className={`appearance-card-preview is-${id}`}
              aria-hidden="true"
            >
              <i />
              <i />
              <i />
            </span>
            <strong>{label}</strong>
            <small>{tr(description, id === "material" ? "Soft surfaces and clear navigation" : "OpenStudyHub's classic look")}</small>
          </label>
        ))}
      </fieldset>
      <fieldset className="appearance-segmented">
        <legend><UiCopy pt="Modo de cor" en="Color mode" /></legend>
        {(
          [
            ["light", "Claro"],
            ["dark", "Escuro"],
            ["system", "Sistema"],
          ] as const
        ).map(([id, label]) => (
          <label key={id} data-selected={value.mode === id}>
            <input
              type="radio"
              name="appearanceMode"
              value={id}
              checked={value.mode === id}
              onChange={() => change("mode", id)}
            />
            {tr(label, { light: "Light", dark: "Dark", system: "System" }[id])}
          </label>
        ))}
      </fieldset>
      <fieldset className="appearance-swatches">
        <legend><UiCopy pt="Cor de destaque" en="Accent color" /></legend>
        {(
          [
            ["neutral", "Neutra"],
            ["green", "Verde"],
            ["blue", "Azul"],
            ["red", "Vermelho"],
            ["purple", "Roxo"],
            ["amber", "Âmbar"],
            ["custom", "Minha cor"],
          ] as const
        ).map(([id, label]) => (
          <label
            key={id}
            title={tr(label, { neutral: "Neutral", green: "Green", blue: "Blue", red: "Red", purple: "Purple", amber: "Amber", custom: "My color" }[id])}
            data-selected={value.accent === id}
            data-accent={id}
          >
            <input
              type="radio"
              name="accent"
              value={id}
              checked={value.accent === id}
              onChange={() => change("accent", id)}
            />
            <span aria-hidden="true" />
            {tr(label, { neutral: "Neutral", green: "Green", blue: "Blue", red: "Red", purple: "Purple", amber: "Amber", custom: "My color" }[id])}
          </label>
        ))}
      </fieldset>
      {value.accent === "custom" ? (
        <label className="appearance-custom-color"><UiCopy pt="Minha cor" en="My color" />
          <input
            type="color"
            name="customAccent"
            value={value.customAccent}
            aria-label={tr("Escolher minha cor de destaque", "Choose my accent color")}
            onChange={(event) =>
              setValue((current) => ({
                ...current,
                accent: "custom",
                customAccent: event.target.value,
              }))
            }
          />
          <small><UiCopy pt="Clique na amostra para escolher. O tom mantém contraste." en="Click the sample to choose. The color keeps adequate contrast." /></small>
        </label>
      ) : (
        <input type="hidden" name="customAccent" value={value.customAccent} />
      )}
      <fieldset className="appearance-segmented">
        <legend><UiCopy pt="Espaçamento" en="Spacing" /></legend>
        {(
          [
            ["comfortable", "Confortável"],
            ["compact", "Compacto"],
          ] as const
        ).map(([id, label]) => (
          <label key={id} data-selected={value.density === id}>
            <input
              type="radio"
              name="density"
              value={id}
              checked={value.density === id}
              onChange={() => change("density", id)}
            />
            {tr(label, id === "comfortable" ? "Comfortable" : "Compact")}
          </label>
        ))}
      </fieldset>
      <fieldset className="appearance-segmented">
        <legend><UiCopy pt="Navegação" en="Navigation" /></legend>
        {(
          [
            ["top", "Superior"],
            ["classic", "Clássica"],
          ] as const
        ).map(([id, label]) => (
          <label key={id} data-selected={value.navigationLayout === id}>
            <input
              type="radio"
              name="navigationLayout"
              value={id}
              checked={value.navigationLayout === id}
              onChange={() => change("navigationLayout", id)}
            />
            {tr(label, id === "top" ? "Top" : "Classic")}
          </label>
        ))}
      </fieldset>
      <p role="status" aria-live="polite">
        {status}
      </p>
    </div>
  );
}
