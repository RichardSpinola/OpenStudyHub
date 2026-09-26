CREATE TABLE extras_settings_v2 (
 key TEXT PRIMARY KEY,
 enabled INTEGER NOT NULL CHECK(enabled IN (0,1))
);
INSERT INTO extras_settings_v2(key,enabled) VALUES
 ('extras',1),('whiteboard',1),('games',1),
 ('snake',1),('2048',1),('minesweeper',1);

CREATE TABLE global_whiteboard_v2 (
 id INTEGER PRIMARY KEY CHECK(id=1),
 scene_json TEXT NOT NULL DEFAULT '[]',
 updated_at INTEGER NOT NULL
);
INSERT INTO global_whiteboard_v2(id,scene_json,updated_at) VALUES(1,'[]',0);
