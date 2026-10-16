ALTER TABLE user_appearance ADD COLUMN wallpaper_blur TEXT NOT NULL DEFAULT 'off' CHECK(wallpaper_blur IN ('off','light','medium','strong'));
