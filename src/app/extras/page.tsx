import { UiCopy } from "@/components/ui-language-provider";
import Link from "next/link";
import { getExtrasFlags, extraAccessible } from "@/lib/v2/extras";
import { withV2Db } from "@/lib/v2/runtime";
import { ExtrasPreview } from "@/components/extras-preview";

export default function ExtrasPage() {
  const flags = withV2Db(getExtrasFlags);
  return (
    <>
      <header className="extras-header">
        <span className="page-kicker">
          <UiCopy pt="OPCIONAL" en="OPTIONAL" />
        </span>
        <h1>Extras</h1>
        <p>
          <UiCopy
            pt="Ferramentas para estudar, desenhar e fazer uma pausa."
            en="Tools to study, draw and take a break."
          />
        </p>
      </header>
      <div className="extras-cards extras-feature-grid" data-tour="extras">
        {extraAccessible(flags, "whiteboard") ? (
          <Link
            href="/extras/whiteboard"
            className="extras-feature-card"
            data-tour="extra-whiteboard"
          >
            <ExtrasPreview kind="whiteboard" />
            <span className="extras-card-copy">
              <strong>
                <UiCopy pt="Quadro Branco" en="Whiteboard" />
              </strong>
              <span>
                <UiCopy
                  pt="Um espaço compartilhado para desenhar e organizar ideias em tempo real."
                  en="A shared space to draw and organize ideas in real time."
                />
              </span>
              <em>
                <UiCopy pt="Abrir quadro →" en="Open whiteboard →" />
              </em>
            </span>
          </Link>
        ) : null}
        {(
          [
            [
              "focus",
              "Foco",
              "Focus",
              "Pomodoro e cronômetro para seu estudo.",
              "Pomodoro and stopwatch for your study.",
            ],
            [
              "flashcards",
              "Flashcards",
              "Flashcards",
              "Crie baralhos, revise e estude com colegas.",
              "Create decks, review and study with classmates.",
            ],
          ] as const
        ).map(([key, title, en, detail, detailEn]) =>
          extraAccessible(flags, key) ? (
            <Link
              key={key}
              href={`/extras/${key}`}
              className="extras-feature-card"
              data-tour={`extra-${key}`}
            >
              <ExtrasPreview kind={key} />
              <span className="extras-card-copy">
                <strong>
                  <UiCopy pt={title} en={en} />
                </strong>
                <span>
                  <UiCopy pt={detail} en={detailEn} />
                </span>
                <em>
                  <UiCopy pt="Abrir →" en="Open →" />
                </em>
              </span>
            </Link>
          ) : null,
        )}
        {extraAccessible(flags, "games") ? (
          <Link
            href="/extras/games"
            className="extras-feature-card"
            data-tour="extra-games"
          >
            <ExtrasPreview kind="games" />
            <span className="extras-card-copy">
              <strong>
                <UiCopy pt="Joguinhos" en="Minigames" />
              </strong>
              <span>
                <UiCopy
                  pt="Nove jogos para uma pausa, incluindo partidas privadas de Dominó."
                  en="Nine games for a break, including private Domino matches."
                />
              </span>
              <em>
                <UiCopy pt="Escolher jogo →" en="Choose game →" />
              </em>
            </span>
          </Link>
        ) : null}
      </div>
    </>
  );
}
