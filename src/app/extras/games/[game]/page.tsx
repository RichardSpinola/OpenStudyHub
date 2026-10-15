import { requireToolUser } from "@/lib/authorization";
import { gameCatalog } from "@/lib/game-catalog";
import { NewGames } from "@/components/new-games";
import { newGameIds, type NewGame } from "@/lib/extra-games";
import { GameExperience } from "@/components/game-experience";
import { UiCopy } from "@/components/ui-language-provider";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  extraAccessible,
  getExtrasFlags,
  type ExtraKey,
} from "@/lib/v2/extras";
import { withV2Db } from "@/lib/v2/runtime";
import { LocalGame } from "@/components/local-game";
import { SolitaireGame } from "@/components/solitaire-game";
import { DominoGame } from "@/components/domino-game";

const games = gameCatalog.map((g) => g.id);

export default async function GamePage({
  params,
  searchParams,
}: {
  params: Promise<{ game: string }>;
  searchParams: Promise<{ invite?: string; match?: string }>;
}) {
  const user = await requireToolUser();
  const { game } = await params;
  const info = gameCatalog.find((g) => g.id === game);
  const query = await searchParams;
  if (!games.includes(game as (typeof games)[number])) notFound();
  const flags = withV2Db(getExtrasFlags);
  if (!extraAccessible(flags, game as ExtraKey)) notFound();
  return (
    <>
      <header className="extras-header">
        <Link href="/extras/games">
          <UiCopy pt="← Joguinhos" en="← Minigames" />
        </Link>
        <h1>
          <UiCopy pt={info?.pt ?? game} en={info?.en ?? game} />
        </h1>
      </header>
      <GameExperience userId={user.id} game={game}>
        {newGameIds.includes(game as NewGame) ? (
          <NewGames game={game as NewGame} userId={user.id} />
        ) : game === "solitaire" ? (
          <SolitaireGame />
        ) : game === "domino" ? (
          <DominoGame initialInvite={query.invite} initialMatch={query.match} />
        ) : (
          <LocalGame
            game={game as "snake" | "2048" | "minesweeper"}
            userId={user.id}
          />
        )}
      </GameExperience>
    </>
  );
}
