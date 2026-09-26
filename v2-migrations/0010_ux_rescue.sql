-- Resumable first-run flow for the canonical V2 user. No V1 migration is changed.
CREATE TABLE user_onboarding_progress (
 user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
 step INTEGER NOT NULL DEFAULT 0 CHECK(step BETWEEN 0 AND 6),
 updated_at INTEGER NOT NULL DEFAULT (unixepoch()*1000)
);

-- Increase the existing fake/personal wallpaper ceiling without editing 0009.
ALTER TABLE user_home_wallpapers RENAME TO user_home_wallpapers_5m_archive;
CREATE TABLE user_home_wallpapers (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 storage_name TEXT NOT NULL UNIQUE,
 mime_type TEXT NOT NULL CHECK(mime_type IN ('image/png','image/jpeg','image/webp')),
 size_bytes INTEGER NOT NULL CHECK(size_bytes > 0 AND size_bytes <= 10485760),
 created_at INTEGER NOT NULL
);
INSERT INTO user_home_wallpapers(id,user_id,storage_name,mime_type,size_bytes,created_at)
 SELECT id,user_id,storage_name,mime_type,size_bytes,created_at FROM user_home_wallpapers_5m_archive;
CREATE TABLE user_home_background_choice_next (
 user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
 preset TEXT NOT NULL DEFAULT 'none' CHECK(preset IN ('none','grid','horizon','paper')),
 selected_wallpaper_id INTEGER REFERENCES user_home_wallpapers(id) ON DELETE SET NULL,
 updated_at INTEGER NOT NULL
);
INSERT INTO user_home_background_choice_next(user_id,preset,selected_wallpaper_id,updated_at)
 SELECT user_id,preset,selected_wallpaper_id,updated_at FROM user_home_background_choice;
DROP TABLE user_home_background_choice;
ALTER TABLE user_home_background_choice_next RENAME TO user_home_background_choice;
DROP TABLE user_home_wallpapers_5m_archive;
CREATE INDEX user_home_wallpapers_recent ON user_home_wallpapers(user_id,created_at DESC,id DESC);

CREATE TABLE offering_covers (
 offering_id INTEGER PRIMARY KEY REFERENCES offerings(id) ON DELETE RESTRICT,
 storage_name TEXT NOT NULL UNIQUE,
 mime_type TEXT NOT NULL CHECK(mime_type IN ('image/png','image/jpeg','image/webp')),
 size_bytes INTEGER NOT NULL CHECK(size_bytes > 0 AND size_bytes <= 5242880),
 updated_at INTEGER NOT NULL
);
CREATE TABLE legacy_offering_links (
 offering_id INTEGER PRIMARY KEY REFERENCES offerings(id) ON DELETE RESTRICT,
 legacy_offering_id INTEGER NOT NULL UNIQUE,
 linked_by_admin_id INTEGER NOT NULL REFERENCES admin_accounts(id) ON DELETE RESTRICT,
 linked_at INTEGER NOT NULL
);

ALTER TABLE user_appearance ADD COLUMN motion TEXT NOT NULL DEFAULT 'system' CHECK(motion IN ('system','reduce'));
ALTER TABLE user_appearance ADD COLUMN contrast TEXT NOT NULL DEFAULT 'system' CHECK(contrast IN ('system','high'));
