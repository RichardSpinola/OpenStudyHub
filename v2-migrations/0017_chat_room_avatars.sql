CREATE TABLE chat_room_avatars (
  legacy_room_id INTEGER PRIMARY KEY,
  image BLOB NOT NULL,
  mime_type TEXT NOT NULL CHECK (mime_type IN ('image/png','image/jpeg','image/webp')),
  version INTEGER NOT NULL
);
