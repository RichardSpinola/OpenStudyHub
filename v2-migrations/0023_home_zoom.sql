ALTER TABLE user_home_presentation ADD COLUMN wallpaper_zoom REAL NOT NULL DEFAULT 1 CHECK(wallpaper_zoom BETWEEN 1 AND 3);
