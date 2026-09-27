import { UiCopy } from "@/components/ui-language-provider";
import Link from "next/link";
import { notFound } from "next/navigation";
import { extraAccessible, getExtrasFlags } from "@/lib/v2/extras";
import { withV2Db } from "@/lib/v2/runtime";
import { ExtrasPreview } from "@/components/extras-preview";

const games = [
  {
    id: "snake",
    label: "Snake",
    detail: "Colete pontos sem encostar no próprio corpo.",
    labelEn: "Snake",
    detailEn: "Collect points without hitting your own body.",
  },
  {
    id: "2048",
    label: "2048",
    detail: "Junte números iguais até chegar a 2048.",
    labelEn: "2048",
    detailEn: "Join equal numbers until you reach 2048.",
  },
  {
    id: "minesweeper",
    label: "Campo Minado",
    detail: "Abra casas sem encontrar minas.",
    labelEn: "Minesweeper",
    detailEn: "Open cells without hitting mines.",
  },
  {
    id: "solitaire",
    label: "Paciência",
    detail: "Organize as cartas no Klondike.",
    labelEn: "Solitaire",
    detailEn: "Arrange the cards in Klondike.",
  },
  {
    id: "domino",
    label: "Dominó",
    detail: "Convide alguém para uma partida privada.",
    labelEn: "Domino",
    detailEn: "Invite someone to a private match.",
  },
] as const;

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
              <ExtrasPreview kind={game.id} />
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
