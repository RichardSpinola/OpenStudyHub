CREATE TABLE personal_tasks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL CHECK(length(trim(title)) BETWEEN 1 AND 180),
  description TEXT NOT NULL DEFAULT '' CHECK(length(description)<=4000),
  offering_key TEXT,
  due_at INTEGER,
  completed_at INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
--> statement-breakpoint
CREATE INDEX personal_tasks_owner_due_idx ON personal_tasks(user_id,completed_at,due_at);
--> statement-breakpoint
CREATE TABLE user_product_tours (
  user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  edition INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL CHECK(status IN ('active','paused','dismissed','completed')),
  mode TEXT NOT NULL CHECK(mode IN ('full','news')),
  step_id TEXT,
  revision INTEGER NOT NULL DEFAULT 1,
  updated_at INTEGER NOT NULL
);

--> statement-breakpoint
INSERT INTO app_settings(key,value,updated_at) VALUES('tour.edition.1.available_since',CAST(unixepoch()*1000 AS TEXT),unixepoch()*1000) ON CONFLICT(key) DO NOTHING;
