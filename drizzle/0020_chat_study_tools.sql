CREATE TABLE chat_message_changes (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 room_id INTEGER NOT NULL REFERENCES chat_rooms(id) ON DELETE CASCADE,
 message_id INTEGER NOT NULL REFERENCES chat_messages(id) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE INDEX chat_message_changes_room ON chat_message_changes(room_id,id);
--> statement-breakpoint
CREATE TRIGGER chat_change_insert AFTER INSERT ON chat_messages BEGIN
 INSERT INTO chat_message_changes(room_id,message_id) VALUES(NEW.room_id,NEW.id); END;
--> statement-breakpoint
CREATE TRIGGER chat_change_update AFTER UPDATE OF body_source,deleted_at ON chat_messages BEGIN
 INSERT INTO chat_message_changes(room_id,message_id) VALUES(NEW.room_id,NEW.id); END;
--> statement-breakpoint
CREATE TABLE flashcard_decks (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 owner_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 title TEXT NOT NULL, description TEXT NOT NULL DEFAULT '',
 offering_id INTEGER REFERENCES subject_offerings(id) ON DELETE SET NULL,
 archived_at INTEGER, updated_at INTEGER NOT NULL
);
--> statement-breakpoint
CREATE TABLE flashcards (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 deck_id INTEGER NOT NULL REFERENCES flashcard_decks(id) ON DELETE CASCADE,
 question TEXT NOT NULL, answer TEXT NOT NULL
);
--> statement-breakpoint
CREATE INDEX flashcards_deck ON flashcards(deck_id,id);
--> statement-breakpoint
CREATE TABLE flashcard_person_shares (
 deck_id INTEGER NOT NULL REFERENCES flashcard_decks(id) ON DELETE CASCADE,
 user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 PRIMARY KEY(deck_id,user_id)
);
--> statement-breakpoint
CREATE TABLE flashcard_group_shares (
 deck_id INTEGER NOT NULL REFERENCES flashcard_decks(id) ON DELETE CASCADE,
 group_id INTEGER NOT NULL REFERENCES study_groups(id) ON DELETE CASCADE,
 PRIMARY KEY(deck_id,group_id)
);
--> statement-breakpoint
CREATE TABLE flashcard_progress (
 card_id INTEGER NOT NULL REFERENCES flashcards(id) ON DELETE CASCADE,
 user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 known INTEGER NOT NULL CHECK(known IN(0,1)), reviewed_at INTEGER NOT NULL,
 PRIMARY KEY(card_id,user_id)
);
--> statement-breakpoint
CREATE TABLE chat_reports (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 reporter_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 message_id INTEGER NOT NULL REFERENCES chat_messages(id) ON DELETE CASCADE,
 room_id INTEGER NOT NULL REFERENCES chat_rooms(id) ON DELETE CASCADE,
 excerpt TEXT NOT NULL, reason TEXT NOT NULL, created_at INTEGER NOT NULL, resolved_at INTEGER
);
