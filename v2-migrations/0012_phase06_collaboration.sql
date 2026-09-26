CREATE TABLE user_chat_room_state (
 user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 room_id INTEGER NOT NULL,
 archived_at INTEGER,
 closed_at INTEGER,
 last_read_message_id INTEGER NOT NULL DEFAULT 0,
 PRIMARY KEY(user_id,room_id)
);
CREATE INDEX user_chat_room_state_room_idx ON user_chat_room_state(room_id);

CREATE TABLE user_chat_wallpaper (
 user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
 preset TEXT NOT NULL DEFAULT 'plain' CHECK(preset IN ('plain','grid','dots')),
 updated_at INTEGER NOT NULL
);

CREATE TABLE realtime_connections (
 connection_id TEXT PRIMARY KEY,
 user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 last_heartbeat_at INTEGER NOT NULL
);
CREATE INDEX realtime_connections_user_time_idx ON realtime_connections(user_id,last_heartbeat_at);

CREATE TABLE user_presence_seen (
 user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
 last_seen_at INTEGER NOT NULL
);

CREATE TABLE push_subscriptions (
 id INTEGER PRIMARY KEY,
 user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 endpoint_hash TEXT NOT NULL UNIQUE,
 endpoint TEXT NOT NULL,
 p256dh TEXT NOT NULL,
 auth TEXT NOT NULL,
 created_at INTEGER NOT NULL,
 last_success_at INTEGER
);
CREATE INDEX push_subscriptions_user_idx ON push_subscriptions(user_id);

CREATE TABLE chat_send_keys (
 user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 client_message_id TEXT NOT NULL,
 room_id INTEGER NOT NULL,
 message_id INTEGER NOT NULL,
 created_at INTEGER NOT NULL,
 PRIMARY KEY(user_id,client_message_id)
);
