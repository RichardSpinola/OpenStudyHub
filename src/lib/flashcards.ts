import { z } from "zod";
import { getDatabase, type DatabaseConnection } from "@/lib/db/client";
import { isUserEnrolled } from "@/lib/enrollments";
import { canViewUser, listUserStudyGroups } from "@/lib/collaboration";
const id = z.number().int().positive(),
  title = z.string().trim().min(1).max(180);
export type Deck = {
  id: number;
  ownerId: number;
  ownerName: string;
  title: string;
  description: string;
  offeringId: number | null;
  archivedAt: number | null;
  updatedAt: number;
  count: number;
  known: number;
  subjectName: string | null;
};
export type Flashcard = {
  id: number;
  question: string;
  answer: string;
  known: boolean | null;
};
const select = `SELECT d.id,d.owner_id ownerId,u.display_name ownerName,d.title,d.description,d.offering_id offeringId,d.archived_at archivedAt,d.updated_at updatedAt,s.name subjectName,
 (SELECT count(*) FROM flashcards c WHERE c.deck_id=d.id) count,
 (SELECT count(*) FROM flashcards c JOIN flashcard_progress p ON p.card_id=c.id WHERE c.deck_id=d.id AND p.user_id=? AND p.known=1) known
 FROM flashcard_decks d JOIN users u ON u.id=d.owner_id LEFT JOIN subject_offerings o ON o.id=d.offering_id LEFT JOIN subjects s ON s.id=o.subject_id`;
const access = `(d.owner_id=? OR (d.archived_at IS NULL AND (EXISTS(SELECT 1 FROM flashcard_person_shares p WHERE p.deck_id=d.id AND p.user_id=?) OR EXISTS(SELECT 1 FROM flashcard_group_shares g JOIN study_group_members m ON m.group_id=g.group_id WHERE g.deck_id=d.id AND m.user_id=?))))`;
function active(userId: number, db: DatabaseConnection) {
  id.parse(userId);
  if (
    !db.sqlite
      .prepare("SELECT 1 FROM users WHERE id=? AND active=1")
      .get(userId)
  )
    throw new Error("Acesso indisponível.");
}
export function listDecks(
  userId: number,
  db: DatabaseConnection = getDatabase(),
): Deck[] {
  active(userId, db);
  return db.sqlite
    .prepare(`${select} WHERE ${access} ORDER BY d.updated_at DESC,d.id DESC`)
    .all(userId, userId, userId, userId) as Deck[];
}
export function readableDeck(
  userId: number,
  deckId: number,
  db: DatabaseConnection = getDatabase(),
): Deck {
  active(userId, db);
  const deck = db.sqlite
    .prepare(`${select} WHERE d.id=? AND ${access}`)
    .get(userId, id.parse(deckId), userId, userId, userId) as Deck | undefined;
  if (!deck) throw new Error("Baralho indisponível. Confira seu acesso.");
  return deck;
}
function owned(userId: number, deckId: number, db: DatabaseConnection) {
  const deck = readableDeck(userId, deckId, db);
  if (deck.ownerId !== userId)
    throw new Error("Somente o proprietário pode alterar este baralho.");
  return deck;
}
export function deckCards(
  userId: number,
  deckId: number,
  db: DatabaseConnection = getDatabase(),
): Flashcard[] {
  readableDeck(userId, deckId, db);
  return (
    db.sqlite
      .prepare(
        "SELECT c.id,c.question,c.answer,p.known FROM flashcards c LEFT JOIN flashcard_progress p ON p.card_id=c.id AND p.user_id=? WHERE c.deck_id=? ORDER BY c.id",
      )
      .all(userId, deckId) as {
      id: number;
      question: string;
      answer: string;
      known: number | null;
    }[]
  ).map((c) => ({ ...c, known: c.known === null ? null : !!c.known }));
}
export const flashcardActionSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("deck"),
    id: id.optional(),
    title,
    description: z.string().trim().max(2000).default(""),
    offeringId: id.nullable().default(null),
  }),
  z.object({
    type: z.literal("card"),
    deckId: id,
    id: id.optional(),
    question: z.string().trim().min(1).max(1000),
    answer: z.string().trim().min(1).max(4000),
  }),
  z.object({ type: z.literal("remove-card"), deckId: id, id }),
  z.object({ type: z.literal("archive"), deckId: id, archived: z.boolean() }),
  z.object({
    type: z.literal("share"),
    deckId: id,
    target: z.enum(["person", "group"]),
    targetId: id,
    enabled: z.boolean(),
  }),
  z.object({
    type: z.literal("review"),
    deckId: id,
    cardId: id,
    known: z.boolean(),
  }),
]);
export function mutateFlashcards(
  userId: number,
  input: unknown,
  db: DatabaseConnection = getDatabase(),
) {
  active(userId, db);
  const value = flashcardActionSchema.parse(input);
  return db.sqlite.transaction(() => {
    if (value.type === "deck") {
      if (
        value.offeringId !== null &&
        !isUserEnrolled(userId, value.offeringId, db)
      )
        throw new Error("Escolha uma disciplina da sua matrícula.");
      if (value.id) {
        owned(userId, value.id, db);
        db.sqlite
          .prepare(
            "UPDATE flashcard_decks SET title=?,description=?,offering_id=?,updated_at=? WHERE id=?",
          )
          .run(
            value.title,
            value.description,
            value.offeringId,
            Date.now(),
            value.id,
          );
        return value.id;
      }
      return Number(
        db.sqlite
          .prepare(
            "INSERT INTO flashcard_decks(owner_id,title,description,offering_id,updated_at) VALUES(?,?,?,?,?)",
          )
          .run(
            userId,
            value.title,
            value.description,
            value.offeringId,
            Date.now(),
          ).lastInsertRowid,
      );
    }
    const deck = readableDeck(userId, value.deckId, db);
    if (value.type === "review") {
      if (
        deck.archivedAt ||
        !db.sqlite
          .prepare("SELECT 1 FROM flashcards WHERE id=? AND deck_id=?")
          .get(value.cardId, deck.id)
      )
        throw new Error("Cartão indisponível.");
      db.sqlite
        .prepare(
          "INSERT INTO flashcard_progress(card_id,user_id,known,reviewed_at) VALUES(?,?,?,?) ON CONFLICT(card_id,user_id) DO UPDATE SET known=excluded.known,reviewed_at=excluded.reviewed_at",
        )
        .run(value.cardId, userId, value.known ? 1 : 0, Date.now());
      return deck.id;
    }
    owned(userId, deck.id, db);
    if (value.type === "archive") {
      db.sqlite
        .prepare(
          "UPDATE flashcard_decks SET archived_at=?,updated_at=? WHERE id=?",
        )
        .run(value.archived ? Date.now() : null, Date.now(), deck.id);
      return deck.id;
    }
    if (deck.archivedAt)
      throw new Error("Restaure o baralho antes de alterar.");
    if (value.type === "card") {
      if (value.id) {
        const result = db.sqlite
          .prepare(
            "UPDATE flashcards SET question=?,answer=? WHERE id=? AND deck_id=?",
          )
          .run(value.question, value.answer, value.id, deck.id);
        if (result.changes !== 1) throw new Error("Cartão indisponível.");
      } else {
        if (deck.count >= 500)
          throw new Error("Use até 500 cartões por baralho.");
        db.sqlite
          .prepare(
            "INSERT INTO flashcards(deck_id,question,answer) VALUES(?,?,?)",
          )
          .run(deck.id, value.question, value.answer);
      }
    } else if (value.type === "remove-card") {
      const result = db.sqlite
        .prepare("DELETE FROM flashcards WHERE id=? AND deck_id=?")
        .run(value.id, deck.id);
      if (result.changes !== 1) throw new Error("Cartão indisponível.");
    } else if (value.type === "share") {
      const table =
          value.target === "person"
            ? "flashcard_person_shares"
            : "flashcard_group_shares",
        column = value.target === "person" ? "user_id" : "group_id";
      if (value.enabled) {
        if (
          value.target === "person" &&
          (value.targetId === userId ||
            !canViewUser(userId, value.targetId, db))
        )
          throw new Error("Pessoa indisponível.");
        if (
          value.target === "group" &&
          !listUserStudyGroups(userId, db).some((g) => g.id === value.targetId)
        )
          throw new Error("Escolha um grupo do qual participa.");
        db.sqlite
          .prepare(
            `INSERT OR IGNORE INTO ${table}(deck_id,${column}) VALUES(?,?)`,
          )
          .run(deck.id, value.targetId);
      } else
        db.sqlite
          .prepare(`DELETE FROM ${table} WHERE deck_id=? AND ${column}=?`)
          .run(deck.id, value.targetId);
    }
    db.sqlite
      .prepare("UPDATE flashcard_decks SET updated_at=? WHERE id=?")
      .run(Date.now(), deck.id);
    return deck.id;
  })();
}
export function deckShares(
  userId: number,
  deckId: number,
  db: DatabaseConnection = getDatabase(),
) {
  owned(userId, deckId, db);
  return {
    people: db.sqlite
      .prepare(
        "SELECT p.user_id id,u.display_name name FROM flashcard_person_shares p JOIN users u ON u.id=p.user_id WHERE p.deck_id=?",
      )
      .all(deckId) as { id: number; name: string }[],
    groups: db.sqlite
      .prepare(
        "SELECT p.group_id id,g.name FROM flashcard_group_shares p JOIN study_groups g ON g.id=p.group_id WHERE p.deck_id=?",
      )
      .all(deckId) as { id: number; name: string }[],
  };
}
