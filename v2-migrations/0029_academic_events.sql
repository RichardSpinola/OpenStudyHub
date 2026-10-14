CREATE TABLE academic_events_v3 (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 institution_id INTEGER NOT NULL REFERENCES institutions(id) ON DELETE RESTRICT,
 program_id INTEGER REFERENCES programs(id) ON DELETE RESTRICT,
 cohort_id INTEGER REFERENCES cohorts(id) ON DELETE RESTRICT,
 offering_id INTEGER REFERENCES offerings(id) ON DELETE RESTRICT,
 kind TEXT NOT NULL CHECK(kind IN ('event','class','exam')),
 title TEXT NOT NULL CHECK(length(trim(title)) BETWEEN 1 AND 180),
 description TEXT NOT NULL DEFAULT '',
 starts_at INTEGER NOT NULL,
 ends_at INTEGER NOT NULL CHECK(ends_at>starts_at),
 cancelled_at INTEGER,
 CHECK((program_id IS NOT NULL)+(cohort_id IS NOT NULL)+(offering_id IS NOT NULL)<=1)
);
CREATE INDEX academic_events_active_time ON academic_events_v3(institution_id,starts_at,ends_at) WHERE cancelled_at IS NULL;
