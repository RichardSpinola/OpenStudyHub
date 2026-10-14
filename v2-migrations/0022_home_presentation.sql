CREATE TABLE user_home_presentation (
 user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
 ascii_font TEXT CHECK(ascii_font IS NULL OR ascii_font IN ('ANSI Shadow','Digital','Future Thin','Rectangles','Small','Small Slant','Standard','Thin','Three Point')),
 wallpaper_x INTEGER NOT NULL DEFAULT 50 CHECK(wallpaper_x BETWEEN 0 AND 100),
 wallpaper_y INTEGER NOT NULL DEFAULT 50 CHECK(wallpaper_y BETWEEN 0 AND 100),
 wallpaper_fit TEXT NOT NULL DEFAULT 'cover' CHECK(wallpaper_fit IN ('cover','contain')),
 updated_at INTEGER NOT NULL
);
