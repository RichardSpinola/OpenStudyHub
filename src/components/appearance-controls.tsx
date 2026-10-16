"use client";
import { UiCopy, useUiText } from "@/components/ui-language-provider";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { saveAppearanceSelectionAction } from "@/app/settings/actions";
import type { Appearance } from "@/lib/appearance";
import { SettingsGroup } from "./settings-group";
import { AvatarShapePreference } from "./avatar-shape-preference";
import { accessibleAccent } from "@/lib/appearance-color";

export function AppearanceControls({
  initial,
  accessibilityOnly = false,
}: {
  initial: Appearance;
  accessibilityOnly?: boolean;
}) {
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
    root.dataset.motion = value.motion;
    root.dataset.contrast = value.contrast;
    root.dataset.wallpaperBlur = value.wallpaperBlur;
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
    if (JSON.stringify(value) === JSON.stringify(lastSaved.current)) return;
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
          setStatus(
            tr(
              "Não foi possível salvar. Tente novamente.",
              "Could not save. Try again.",
            ),
          );
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
    <div
      className="appearance-controls appearance-visual-controls"
      data-tour="appearance-controls"
    >
      {!accessibilityOnly ? (
        <>
          <SettingsGroup
            title={tr("Tema e modo", "Theme and mode")}
            description={tr(
              "Escolha o visual base e como ele acompanha a iluminação da tela.",
              "Choose the base design and how it follows your screen's color mode.",
            )}
          >
            <fieldset className="appearance-choice-grid">
              <legend>
                <UiCopy pt="Visual do aplicativo" en="App appearance" />
              </legend>
              {(
                [
                  [
                    "material",
                    "Material",
                    "Superfícies suaves e navegação clara",
                  ],
                  [
                    "legacy",
                    "Legacy / TUI",
                    "Identidade clássica do OpenStudyHub",
                  ],
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
                  <small>
                    {tr(
                      description,
                      id === "material"
                        ? "Soft surfaces and clear navigation"
                        : "OpenStudyHub's classic look",
                    )}
                  </small>
                </label>
              ))}
            </fieldset>
            <fieldset className="appearance-segmented">
              <legend>
                <UiCopy pt="Modo de cor" en="Color mode" />
              </legend>
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
                  {tr(
                    label,
                    { light: "Light", dark: "Dark", system: "System" }[id],
                  )}
                </label>
              ))}
            </fieldset>
          </SettingsGroup>
          <SettingsGroup
            title={tr("Cores e espaçamento", "Colors and spacing")}
            description={tr(
              "Um destaque para os controles e a densidade que fica confortável para você.",
              "An accent for controls and the density that feels comfortable to you.",
            )}
          >
            <fieldset className="appearance-swatches">
              <legend>
                <UiCopy pt="Cor de destaque" en="Accent color" />
              </legend>
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
                  title={tr(
                    label,
                    {
                      neutral: "Neutral",
                      green: "Green",
                      blue: "Blue",
                      red: "Red",
                      purple: "Purple",
                      amber: "Amber",
                      custom: "My color",
                    }[id],
                  )}
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
                  {tr(
                    label,
                    {
                      neutral: "Neutral",
                      green: "Green",
                      blue: "Blue",
                      red: "Red",
                      purple: "Purple",
                      amber: "Amber",
                      custom: "My color",
                    }[id],
                  )}
                </label>
              ))}
            </fieldset>
            {value.accent === "custom" ? (
              <label className="appearance-custom-color">
                <UiCopy pt="Minha cor" en="My color" />
                <input
                  type="color"
                  name="customAccent"
                  value={value.customAccent}
                  aria-label={tr(
                    "Escolher minha cor de destaque",
                    "Choose my accent color",
                  )}
                  onChange={(event) =>
                    setValue((current) => ({
                      ...current,
                      accent: "custom",
                      customAccent: event.target.value,
                    }))
                  }
                />
                <small>
                  <UiCopy
                    pt="Clique na amostra para escolher. O tom mantém contraste."
                    en="Click the sample to choose. The color keeps adequate contrast."
                  />
                </small>
              </label>
            ) : (
              <input
                type="hidden"
                name="customAccent"
                value={value.customAccent}
              />
            )}
            <fieldset className="appearance-segmented">
              <legend>
                <UiCopy pt="Espaçamento" en="Spacing" />
              </legend>
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
          </SettingsGroup>
          <SettingsGroup
            title={tr("Navegação e avatar", "Navigation and avatar")}
            description={tr(
              "Veja onde fica o menu principal e personalize a forma da sua foto.",
              "Choose where the main menu sits and customize your photo's shape.",
            )}
          >
            <fieldset className="appearance-segmented">
              <legend>
                <UiCopy pt="Navegação" en="Navigation" />
              </legend>
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
                  <span
                    className={`appearance-nav-preview is-${id}`}
                    aria-hidden="true"
                  >
                    <i />
                    <b />
                    <b />
                    <b />
                  </span>
                  {tr(label, id === "top" ? "Top" : "Classic")}
                </label>
              ))}
            </fieldset>
            <AvatarShapePreference />
          </SettingsGroup>
          <SettingsGroup
            title={tr(
              "Wallpaper e transparência",
              "Wallpaper and transparency",
            )}
            description={tr(
              "Traga sua imagem da Home para o fundo das áreas comuns. O conteúdo continua em painéis legíveis.",
              "Bring your Home image into common-area backgrounds. Content stays on readable panels.",
            )}
          >
            <div
              className="appearance-blur-preview"
              data-level={value.wallpaperBlur}
              aria-hidden="true"
            >
              <i />
              <span />
              <span />
              <b />
            </div>
            <fieldset className="appearance-segmented">
              <legend>
                <UiCopy
                  pt="Wallpaper desfocado nas áreas comuns e navegação"
                  en="Blurred wallpaper in common areas and navigation"
                />
              </legend>
              {(
                [
                  ["off", "Desligado", "Off"],
                  ["light", "Leve", "Light"],
                  ["medium", "Médio", "Medium"],
                  ["strong", "Forte", "Strong"],
                ] as const
              ).map(([id, pt, en]) => (
                <label key={id} data-selected={value.wallpaperBlur === id}>
                  <input
                    type="radio"
                    name="wallpaperBlur"
                    checked={value.wallpaperBlur === id}
                    onChange={() => change("wallpaperBlur", id)}
                  />
                  {tr(pt, en)}
                </label>
              ))}
              <small>
                <UiCopy
                  pt="Usa sua imagem da Home. Sem imagem, mantém o fundo sólido. Chat e editores mantêm seu próprio fundo."
                  en="Uses your Home image. Without an image, the background stays solid. Chat and editors keep their own background."
                />
              </small>
            </fieldset>
          </SettingsGroup>
        </>
      ) : (
        <>
          <SettingsGroup
            title={tr("Movimento", "Motion")}
            description={tr(
              "Transições discretas ou movimento reduzido, inclusive nos jogos.",
              "Subtle transitions or reduced motion, including games.",
            )}
          >
            <fieldset className="appearance-segmented">
              <legend>
                <UiCopy pt="Movimento" en="Motion" />
              </legend>
              {(
                [
                  ["system", "Seguir o sistema", "Follow system"],
                  ["reduce", "Reduzir movimento", "Reduce motion"],
                ] as const
              ).map(([id, pt, en]) => (
                <label key={id} data-selected={value.motion === id}>
                  <input
                    type="radio"
                    name="motion"
                    checked={value.motion === id}
                    onChange={() => change("motion", id)}
                  />
                  {tr(pt, en)}
                </label>
              ))}
            </fieldset>
          </SettingsGroup>
          <SettingsGroup
            title={tr("Contraste", "Contrast")}
            description={tr(
              "Reforce a separação entre texto, controles e fundo.",
              "Strengthen separation between text, controls and background.",
            )}
          >
            <fieldset className="appearance-segmented">
              <legend>
                <UiCopy pt="Contraste" en="Contrast" />
              </legend>
              {(
                [
                  ["system", "Padrão", "Default"],
                  ["high", "Alto", "High"],
                ] as const
              ).map(([id, pt, en]) => (
                <label key={id} data-selected={value.contrast === id}>
                  <input
                    type="radio"
                    name="contrast"
                    checked={value.contrast === id}
                    onChange={() => change("contrast", id)}
                  />
                  {tr(pt, en)}
                </label>
              ))}
            </fieldset>
          </SettingsGroup>
        </>
      )}
      <p role="status" aria-live="polite">
        {status}
      </p>
    </div>
  );
}
