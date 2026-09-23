-- The V2 user is the normal identity; legacy IDs are explicit compatibility links.
CREATE TABLE legacy_user_links (
 user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE RESTRICT,
 legacy_user_id INTEGER NOT NULL UNIQUE,
 linked_at INTEGER NOT NULL DEFAULT (unixepoch()*1000)
);
CREATE TABLE google_oauth_states_v2 (
 state_hash TEXT PRIMARY KEY,
 user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 encrypted_verifier TEXT NOT NULL,
 expires_at INTEGER NOT NULL
);
CREATE TABLE google_connections_v2 (
 user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE RESTRICT,
 google_subject TEXT NOT NULL UNIQUE,
 encrypted_refresh_token TEXT,
 scopes TEXT NOT NULL,
 status TEXT NOT NULL CHECK(status IN ('connected','needs_reconnect')),
 updated_at INTEGER NOT NULL
);
CREATE TABLE classroom_courses_v2 (
 user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 course_id TEXT NOT NULL,
 name TEXT NOT NULL,
 section TEXT,
 fetched_at INTEGER NOT NULL,
 PRIMARY KEY(user_id,course_id)
);
CREATE TABLE classroom_sync_v2 (
 user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 offering_id INTEGER NOT NULL REFERENCES offerings(id) ON DELETE CASCADE,
 last_attempt_at INTEGER,
 last_success_at INTEGER,
 status TEXT NOT NULL DEFAULT 'idle' CHECK(status IN ('idle','updating','ready','error','needs_reconnect')),
 error_code TEXT,
 PRIMARY KEY(user_id,offering_id)
);
CREATE TABLE classroom_feed_v2 (
 user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 offering_id INTEGER NOT NULL REFERENCES offerings(id) ON DELETE CASCADE,
 external_id TEXT NOT NULL,
 title TEXT NOT NULL,
 link TEXT,
 published_at TEXT,
 PRIMARY KEY(user_id,offering_id,external_id)
);
