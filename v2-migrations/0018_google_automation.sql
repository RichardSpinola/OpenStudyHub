CREATE TABLE google_automation_v2 (
  id INTEGER PRIMARY KEY CHECK (id=1),
  interval_minutes INTEGER NOT NULL DEFAULT 60 CHECK (interval_minutes IN (0,15,30,60,120,360)),
  last_run_at INTEGER,
  last_finished_at INTEGER,
  last_drive_check_at INTEGER,
  drive_status TEXT NOT NULL DEFAULT 'pending' CHECK (drive_status IN ('pending','ready','needs_reconnect','permission_denied','missing','error')),
  lease_token TEXT,
  lease_until INTEGER
);
INSERT INTO google_automation_v2(id,interval_minutes,last_run_at) VALUES(1,60,unixepoch()*1000);
