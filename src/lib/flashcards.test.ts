import { beforeEach, afterEach, it, expect } from "vitest";
import { createMigratedTestDatabase } from "./test-database";
import type { DatabaseConnection } from "./db/client";
import {
  mutateFlashcards,
  readableDeck,
  deckCards,
  listDecks,
  deckShares,
} from "./flashcards";
let db: DatabaseConnection;
beforeEach(() => {
  db = createMigratedTestDatabase();
  db.sqlite.exec(
    "INSERT INTO users(id,display_name,login,password_hash,role,active) VALUES(1,'Ana','ana','h','member',1),(2,'Bia','bia','h','member',1),(3,'Caio','caio','h','member',1);INSERT INTO study_groups(id,name,created_by_user_id,created_at,updated_at) VALUES(1,'Estudo',1,1,1);INSERT INTO study_group_members(group_id,user_id,member_role,joined_at) VALUES(1,1,'owner',1),(1,2,'member',1);",
  );
});
afterEach(() => db.close());
const create = () => mutateFlashcards(1, { type: "deck", title: "Redes" }, db);
it("starts private, preserves content on invalid edits and requires enrolled subjects", () => {
  const id = create();
  expect(listDecks(2, db)).toEqual([]);
  expect(() => readableDeck(2, id, db)).toThrow();
  expect(() =>
    mutateFlashcards(1, { type: "deck", id, title: "   " }, db),
  ).toThrow();
  expect(readableDeck(1, id, db).title).toBe("Redes");
  expect(() =>
    mutateFlashcards(1, { type: "deck", title: "X", offeringId: 999 }, db),
  ).toThrow();
});
it("shares reading, keeps private per-person progress and revokes access", () => {
  const id = create();
  mutateFlashcards(
    1,
    { type: "card", deckId: id, question: "DNS?", answer: "Nomes" },
    db,
  );
  const card = deckCards(1, id, db)[0];
  mutateFlashcards(
    1,
    { type: "share", deckId: id, target: "person", targetId: 2, enabled: true },
    db,
  );
  expect(deckCards(2, id, db)[0].answer).toBe("Nomes");
  expect(() =>
    mutateFlashcards(
      2,
      { type: "card", deckId: id, id: card.id, question: "X", answer: "Y" },
      db,
    ),
  ).toThrow("proprietário");
  expect(() => deckShares(2, id, db)).toThrow();
  mutateFlashcards(
    2,
    { type: "review", deckId: id, cardId: card.id, known: true },
    db,
  );
  expect(readableDeck(2, id, db).known).toBe(1);
  expect(readableDeck(1, id, db).known).toBe(0);
  mutateFlashcards(
    1,
    {
      type: "share",
      deckId: id,
      target: "person",
      targetId: 2,
      enabled: false,
    },
    db,
  );
  expect(() =>
    mutateFlashcards(
      2,
      { type: "review", deckId: id, cardId: card.id, known: true },
      db,
    ),
  ).toThrow();
});
it("checks current group membership and requires the sharing owner to belong to the group", () => {
  const id = create();
  expect(() =>
    mutateFlashcards(
      1,
      {
        type: "share",
        deckId: id,
        target: "group",
        targetId: 999,
        enabled: true,
      },
      db,
    ),
  ).toThrow();
  mutateFlashcards(
    1,
    { type: "share", deckId: id, target: "group", targetId: 1, enabled: true },
    db,
  );
  expect(readableDeck(2, id, db).id).toBe(id);
  expect(() => readableDeck(3, id, db)).toThrow();
  db.sqlite
    .prepare("DELETE FROM study_group_members WHERE group_id=1 AND user_id=2")
    .run();
  expect(() => readableDeck(2, id, db)).toThrow();
});
it("archives and restores content and progress, and blocks a card from another deck", () => {
  const id = create(),
    other = create();
  mutateFlashcards(
    1,
    { type: "card", deckId: id, question: "Q", answer: "A" },
    db,
  );
  const card = deckCards(1, id, db)[0];
  expect(() =>
    mutateFlashcards(
      1,
      { type: "review", deckId: other, cardId: card.id, known: true },
      db,
    ),
  ).toThrow();
  mutateFlashcards(
    1,
    { type: "review", deckId: id, cardId: card.id, known: true },
    db,
  );
  mutateFlashcards(1, { type: "archive", deckId: id, archived: true }, db);
  expect(() =>
    mutateFlashcards(
      1,
      { type: "card", deckId: id, question: "Q", answer: "A" },
      db,
    ),
  ).toThrow("Restaure");
  mutateFlashcards(1, { type: "archive", deckId: id, archived: false }, db);
  expect(deckCards(1, id, db)[0].known).toBe(true);
  expect(db.sqlite.pragma("foreign_key_check")).toEqual([]);
});
