CREATE TABLE user_profile_links (
 id INTEGER PRIMARY KEY,
 user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 label TEXT NOT NULL,
 url TEXT NOT NULL,
 created_at INTEGER NOT NULL,
 UNIQUE(user_id,url)
);
CREATE INDEX user_profile_links_user_idx ON user_profile_links(user_id,id);
