-- Separate administrative and normal-user authentication state.
ALTER TABLE users ADD COLUMN must_change_password INTEGER NOT NULL DEFAULT 0 CHECK(must_change_password IN (0,1));
ALTER TABLE admin_accounts ADD COLUMN must_change_password INTEGER NOT NULL DEFAULT 0 CHECK(must_change_password IN (0,1));
CREATE TABLE admin_sessions (
 id INTEGER PRIMARY KEY,
 admin_id INTEGER NOT NULL REFERENCES admin_accounts(id) ON DELETE RESTRICT,
 token_hash TEXT NOT NULL UNIQUE,
 created_at INTEGER NOT NULL,
 expires_at INTEGER NOT NULL,
 revoked_at INTEGER
);
CREATE INDEX admin_sessions_active ON admin_sessions(admin_id,expires_at) WHERE revoked_at IS NULL;
CREATE TABLE user_sessions (
 id INTEGER PRIMARY KEY,
 user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
 token_hash TEXT NOT NULL UNIQUE,
 created_at INTEGER NOT NULL,
 expires_at INTEGER NOT NULL,
 revoked_at INTEGER
);
CREATE INDEX user_sessions_active ON user_sessions(user_id,expires_at) WHERE revoked_at IS NULL;
CREATE TABLE cohort_transition_events (
 id INTEGER PRIMARY KEY,
 cohort_id INTEGER NOT NULL REFERENCES cohorts(id) ON DELETE RESTRICT,
 from_cohort_period_id INTEGER REFERENCES cohort_periods(id) ON DELETE RESTRICT,
 to_cohort_period_id INTEGER NOT NULL REFERENCES cohort_periods(id) ON DELETE RESTRICT,
 actor_admin_id INTEGER REFERENCES admin_accounts(id) ON DELETE RESTRICT,
 actor_user_id INTEGER REFERENCES users(id) ON DELETE RESTRICT,
 occurred_at INTEGER NOT NULL DEFAULT (unixepoch()*1000),
 CHECK((actor_admin_id IS NOT NULL) != (actor_user_id IS NOT NULL)),
 UNIQUE(to_cohort_period_id)
);
