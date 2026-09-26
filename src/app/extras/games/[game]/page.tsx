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

const games = ["snake", "2048", "minesweeper", "solitaire", "domino"] as const;

export default async function GamePage({
  params,
  searchParams,
}: {
  params: Promise<{ game: string }>;
  searchParams: Promise<{ invite?: string; match?: string }>;
}) {
  const { game } = await params;
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
          {game === "minesweeper" ? (
            "Campo Minado"
          ) : game === "solitaire" ? (
            <UiCopy pt="Paciência" en="Solitaire" />
          ) : game === "domino" ? (
            <UiCopy pt="Dominó" en="Domino" />
          ) : game === "snake" ? (
            "Snake"
          ) : (
            "2048"
          )}
        </h1>
      </header>
      {game === "solitaire" ? (
        <SolitaireGame />
      ) : game === "domino" ? (
        <DominoGame initialInvite={query.invite} initialMatch={query.match} />
      ) : (
        <LocalGame game={game as "snake" | "2048" | "minesweeper"} />
      )}
    </>
  );
}
