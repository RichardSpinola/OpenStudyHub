import { readSmallJson } from "@/lib/small-json";
import { NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/authorization";
import { assertToolAvailable } from "@/lib/v2/exam-access";
import { extraAccessible, getExtrasFlags } from "@/lib/v2/extras";
import { withV2Db } from "@/lib/v2/runtime";
import { sameNoteRequestOrigin } from "@/lib/note-request-origin";
import {
  deckCards,
  deckShares,
  listDecks,
  mutateFlashcards,
  readableDeck,
} from "@/lib/flashcards";
import { listVisibleUsers, listUserStudyGroups } from "@/lib/collaboration";
import {
  listEnrollmentOfferings,
  listUserEnrollmentIds,
} from "@/lib/enrollments";
export const dynamic = "force-dynamic";
async function user() {
  const session = await getCurrentSession();
  if (!session) throw new Error("Entre novamente.");
  assertToolAvailable(session.user.id);
  if (!extraAccessible(withV2Db(getExtrasFlags), "flashcards"))
    throw new Error("Ferramenta indisponível.");
  return session.user.id;
}
export async function GET(request: Request) {
  try {
    const userId = await user(),
      raw = new URL(request.url).searchParams.get("deck");
    if (raw) {
      const deck = readableDeck(userId, Number(raw));
      return NextResponse.json(
        {
          deck,
          cards: deckCards(userId, deck.id),
          shares: deck.ownerId === userId ? deckShares(userId, deck.id) : null,
        },
        { headers: { "cache-control": "private, no-store" } },
      );
    }
    return NextResponse.json(
      {
        decks: listDecks(userId),
        people: listVisibleUsers(userId),
        groups: listUserStudyGroups(userId),
        offerings: listEnrollmentOfferings().filter((o) =>
          listUserEnrollmentIds(userId).includes(o.offeringId),
        ),
        userId,
      },
      { headers: { "cache-control": "private, no-store" } },
    );
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Não foi possível abrir.",
      },
      { status: 403, headers: { "cache-control": "no-store" } },
    );
  }
}
export async function POST(request: Request) {
  if (!sameNoteRequestOrigin(request.headers))
    return NextResponse.json({ error: "Origem inválida." }, { status: 403 });
  try {
    const userId = await user();
    const id = mutateFlashcards(userId, await readSmallJson(request));
    return NextResponse.json(
      { id },
      { headers: { "cache-control": "no-store" } },
    );
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error && !("issues" in error)
            ? error.message
            : "Confira os campos e tente novamente.",
      },
      { status: 400 },
    );
  }
}
