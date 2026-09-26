INSERT INTO extras_settings_v2(key,enabled) VALUES ('solitaire',1),('domino',1);

CREATE TABLE google_connection_health_v2 (
 user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
 checked_at INTEGER,
 result TEXT NOT NULL DEFAULT 'pending' CHECK(result IN ('pending','ready','temporary_error','needs_reconnect')),
 dismissed_incident_at INTEGER
);

CREATE TABLE domino_matches_v2 (
 id TEXT PRIMARY KEY,
 invite_code TEXT NOT NULL UNIQUE,
 owner_id INTEGER NOT NULL REFERENCES users(id),
 guest_id INTEGER REFERENCES users(id),
 state_json TEXT NOT NULL,
 version INTEGER NOT NULL DEFAULT 1,
 updated_at INTEGER NOT NULL,
 CHECK(guest_id IS NULL OR guest_id <> owner_id)
);
CREATE INDEX domino_matches_players_v2 ON domino_matches_v2(owner_id,guest_id,updated_at);
