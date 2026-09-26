CREATE TABLE user_appearance (
 user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
 theme TEXT NOT NULL DEFAULT 'material' CHECK(theme IN ('material','tui','legacy','custom')),
 mode TEXT NOT NULL DEFAULT 'dark' CHECK(mode IN ('dark','light','system')),
 density TEXT NOT NULL DEFAULT 'comfortable' CHECK(density IN ('comfortable','compact')),
 accent TEXT NOT NULL DEFAULT 'neutral' CHECK(accent IN ('neutral','green','blue','red','purple','amber','custom')),
 custom_accent TEXT NOT NULL DEFAULT '#6e7680' CHECK(length(custom_accent)=7 AND custom_accent GLOB '#[0-9A-Fa-f][0-9A-Fa-f][0-9A-Fa-f][0-9A-Fa-f][0-9A-Fa-f][0-9A-Fa-f]'),
 navigation_layout TEXT NOT NULL DEFAULT 'top' CHECK(navigation_layout IN ('top','classic')),
 overview_focus TEXT NOT NULL DEFAULT 'wall' CHECK(overview_focus IN ('wall','timeline')),
 search_engine TEXT NOT NULL DEFAULT 'google' CHECK(search_engine IN ('google','scholar','duckduckgo','startpage','ecosia')),
 updated_at INTEGER NOT NULL
);
