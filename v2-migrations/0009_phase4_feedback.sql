CREATE TABLE user_academic_preferences (
 user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
 overview_focus TEXT NOT NULL DEFAULT 'wall' CHECK(overview_focus IN ('wall','timeline')),
 show_subject_history INTEGER NOT NULL DEFAULT 0 CHECK(show_subject_history IN (0,1)),
 updated_at INTEGER NOT NULL
);
INSERT INTO user_academic_preferences(user_id,overview_focus,show_subject_history,updated_at)
 SELECT user_id,overview_focus,0,updated_at FROM user_appearance;

CREATE TABLE user_appearance_next (
 user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
 theme TEXT NOT NULL DEFAULT 'material' CHECK(theme IN ('material','legacy','custom')),
 mode TEXT NOT NULL DEFAULT 'dark' CHECK(mode IN ('dark','light','system')),
 density TEXT NOT NULL DEFAULT 'comfortable' CHECK(density IN ('comfortable','compact')),
 accent TEXT NOT NULL DEFAULT 'neutral' CHECK(accent IN ('neutral','green','blue','red','purple','amber','custom')),
 custom_accent TEXT NOT NULL DEFAULT '#6e7680' CHECK(length(custom_accent)=7 AND custom_accent GLOB '#[0-9A-Fa-f][0-9A-Fa-f][0-9A-Fa-f][0-9A-Fa-f][0-9A-Fa-f][0-9A-Fa-f]'),
 navigation_layout TEXT NOT NULL DEFAULT 'top' CHECK(navigation_layout IN ('top','classic')),
 search_engine TEXT NOT NULL DEFAULT 'google' CHECK(search_engine IN ('google','scholar','duckduckgo','startpage','ecosia')),
 updated_at INTEGER NOT NULL
);
INSERT INTO user_appearance_next(user_id,theme,mode,density,accent,custom_accent,navigation_layout,search_engine,updated_at)
 SELECT user_id,CASE WHEN theme='tui' THEN 'legacy' ELSE theme END,mode,density,accent,custom_accent,navigation_layout,search_engine,updated_at
 FROM user_appearance;
DROP TABLE user_appearance;
ALTER TABLE user_appearance_next RENAME TO user_appearance;

CREATE TABLE user_home_wallpapers (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 storage_name TEXT NOT NULL UNIQUE,
 mime_type TEXT NOT NULL CHECK(mime_type IN ('image/png','image/jpeg','image/webp')),
 size_bytes INTEGER NOT NULL CHECK(size_bytes > 0 AND size_bytes <= 5242880),
 created_at INTEGER NOT NULL
);
CREATE INDEX user_home_wallpapers_recent ON user_home_wallpapers(user_id,created_at DESC,id DESC);
CREATE TABLE user_home_background_choice (
 user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
 preset TEXT NOT NULL DEFAULT 'none' CHECK(preset IN ('none','grid','horizon','paper')),
 selected_wallpaper_id INTEGER REFERENCES user_home_wallpapers(id) ON DELETE SET NULL,
 updated_at INTEGER NOT NULL
);
