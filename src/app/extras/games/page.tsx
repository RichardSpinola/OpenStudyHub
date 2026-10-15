import { UiCopy } from "@/components/ui-language-provider";
import Link from "next/link";
import { notFound } from "next/navigation";
import { extraAccessible, getExtrasFlags } from "@/lib/v2/extras";
import { withV2Db } from "@/lib/v2/runtime";
import { ExtrasPreview } from "@/components/extras-preview";

import { gameCatalog } from "@/lib/game-catalog";
const games = gameCatalog.map((g) => ({ ...g, label: g.pt, labelEn: g.en }));

export default function GamesPage() {
  const flags = withV2Db(getExtrasFlags);
  if (!extraAccessible(flags, "games")) notFound();
  return (
    <>
      <header className="extras-header">
        <Link href="/extras">
          <UiCopy pt="← Extras" en="← Extras" />
        </Link>
        <h1>
          <UiCopy pt="Joguinhos" en="Minigames" />
        </h1>
        <p>
          <UiCopy
            pt="Jogos sem anúncios nem conta externa; Dominó permite partidas privadas entre usuários da instância."
            en="Games without ads or external accounts; Domino supports private matches between instance users."
          />
        </p>
      </header>
      <div className="extras-cards extras-games-grid">
        {games
          .filter((game) => extraAccessible(flags, game.id))
          .map((game) => (
            <Link
              key={game.id}
              href={`/extras/games/${game.id}`}
              className="game-catalog-card"
              data-game={game.id}
            >
              {["memory", "sudoku", "connect4", "tictactoe"].includes(
                game.id,
              ) ? (
                <div
                  className="new-game-preview"
                  data-game={game.id}
                  aria-hidden="true"
                >
                  {(game.id === "memory"
                    ? ["★", "?", "?", "★"]
                    : game.id === "sudoku"
                      ? ["1", "·", "3", "·", "5", "·", "7", "·", "9"]
                      : game.id === "connect4"
                        ? ["●", "○", "●", "○", "●", "○", "●", "○", "●"]
                        : ["X", "O", "·", "·", "X", "·", "O", "·", "X"]
                  ).map((v, i) => (
                    <span key={i}>{v}</span>
                  ))}
                </div>
              ) : (
                <ExtrasPreview
                  kind={
                    game.id as
                      "snake" | "2048" | "minesweeper" | "solitaire" | "domino"
                  }
                />
              )}
              <span className="extras-card-copy">
                <strong>
                  <UiCopy pt={game.label} en={game.labelEn} />
                </strong>
                <span>
                  <UiCopy pt={game.detail} en={game.detailEn} />
                </span>
                <em>
                  <UiCopy pt="Jogar →" en="Play →" />
                </em>
              </span>
            </Link>
          ))}
      </div>
    </>
  );
}
