"use client";

import { useState, useTransition } from "react";
import { extraKeys, type ExtraKey, type ExtrasFlags } from "@/lib/v2/extras";
import { saveExtrasAction } from "./actions";

import { gameCatalog } from "@/lib/game-catalog";
const games = gameCatalog.map((g) => ({
  key: g.id,
  label: g.pt,
  labelEn: g.en,
  detail: g.detail,
  detailEn: g.detailEn,
}));

export function ExtrasForm({
  initial,
  english,
}: {
  initial: ExtrasFlags;
  english: boolean;
}) {
  const tr = (pt: string, en: string) => (english ? en : pt);
  const [flags, setFlags] = useState<ExtrasFlags>(initial);
  const [savedFlags, setSavedFlags] = useState<ExtrasFlags>(initial);
  const [message, setMessage] = useState<"saved" | "error" | null>(null);
  const [pending, startTransition] = useTransition();
  const dirty = extraKeys.some((key) => flags[key] !== savedFlags[key]);

  function option(
    key: ExtraKey,
    label: string,
    detail: string,
    disabled = false,
  ) {
    return (
      <label className="control-extras-option" data-disabled={disabled}>
        <input
          type="checkbox"
          checked={flags[key]}
          disabled={disabled || pending}
          onChange={() => {
            setFlags((current) => ({ ...current, [key]: !current[key] }));
            setMessage(null);
          }}
        />
        <span className="control-extras-option-copy">
          <strong>{label}</strong>
          <small>{detail}</small>
        </span>
      </label>
    );
  }

  function save() {
    const next = { ...flags };
    const form = new FormData();
    for (const key of extraKeys) if (next[key]) form.set(key, "on");
    startTransition(async () => {
      try {
        await saveExtrasAction(form);
        setSavedFlags(next);
        setMessage("saved");
      } catch {
        setMessage("error");
      }
    });
  }

  return (
    <div className="control-extras">
      <p className="control-extras-intro">
        {tr(
          "Escolha o que aparece para os usuários da instância. Desativar uma área também impede o acesso às suas páginas.",
          "Choose what instance users can access. Disabling an area also blocks its pages.",
        )}
      </p>
      <section
        className="control-extras-group"
        aria-labelledby="extras-visibility"
      >
        <div className="control-extras-group-heading">
          <span>01</span>
          <div>
            <h2 id="extras-visibility">{tr("Visibilidade", "Visibility")}</h2>
            <p>
              {tr(
                "Controle a entrada Extras na navegação principal.",
                "Control Extras in the main navigation.",
              )}
            </p>
          </div>
        </div>
        {option(
          "extras",
          tr("Exibir Extras", "Show Extras"),
          tr(
            "Mostra a área opcional no App.",
            "Shows the optional area in the App.",
          ),
        )}
      </section>
      <section
        className="control-extras-group"
        aria-labelledby="extras-resources"
      >
        <div className="control-extras-group-heading">
          <span>02</span>
          <div>
            <h2 id="extras-resources">{tr("Recursos", "Features")}</h2>
            <p>
              {tr(
                "Disponíveis quando Extras está ativo.",
                "Available when Extras is enabled.",
              )}
            </p>
          </div>
        </div>
        {option(
          "whiteboard",
          tr("Quadro Branco", "Whiteboard"),
          tr(
            "Quadro colaborativo da instância.",
            "Collaborative instance whiteboard.",
          ),
          !flags.extras,
        )}
        {option(
          "focus",
          tr("Foco: Pomodoro e cronômetro", "Focus: Pomodoro and stopwatch"),
          tr("Sessões de estudo e pausas.", "Study sessions and breaks."),
          !flags.extras,
        )}
        {option(
          "flashcards",
          tr("Flashcards", "Flashcards"),
          tr(
            "Baralhos pessoais e compartilhados.",
            "Personal and shared decks.",
          ),
          !flags.extras,
        )}
        {option(
          "games",
          tr("Joguinhos", "Minigames"),
          tr("Área opcional de minigames.", "Optional minigames area."),
          !flags.extras,
        )}
      </section>
      <section className="control-extras-group" aria-labelledby="extras-games">
        <div className="control-extras-group-heading">
          <span>03</span>
          <div>
            <h2 id="extras-games">
              {tr("Joguinhos disponíveis", "Available minigames")}
            </h2>
            <p>
              {tr(
                "Escolha quais jogos aparecem dentro de Joguinhos.",
                "Choose which games appear in Minigames.",
              )}
            </p>
          </div>
        </div>
        <div className="control-extras-games">
          {games.map(({ key, label, labelEn, detail, detailEn }) => (
            <div key={key}>
              {option(
                key,
                tr(label, labelEn),
                tr(detail, detailEn),
                !flags.extras || !flags.games,
              )}
            </div>
          ))}
        </div>
      </section>
      <div className="control-extras-save">
        <span role="status" aria-live="polite">
          {message === "error"
            ? tr(
                "Não foi possível salvar. Tente novamente.",
                "Could not save. Try again.",
              )
            : dirty
              ? tr("Há alterações não salvas.", "There are unsaved changes.")
              : message === "saved"
                ? tr("Alterações salvas.", "Changes saved.")
                : tr(
                    "Todas as alterações estão salvas.",
                    "All changes are saved.",
                  )}
        </span>
        <button type="button" onClick={save} disabled={!dirty || pending}>
          {pending
            ? tr("Salvando…", "Saving…")
            : tr("Salvar alterações", "Save changes")}
        </button>
      </div>
    </div>
  );
}
