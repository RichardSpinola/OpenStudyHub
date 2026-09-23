CREATE TABLE v2_auth_attempts (
 id INTEGER PRIMARY KEY,
 realm TEXT NOT NULL CHECK(realm IN ('admin','user')),
 login_hash TEXT NOT NULL,
 attempted_at INTEGER NOT NULL
);
CREATE INDEX v2_auth_attempts_window ON v2_auth_attempts(realm,login_hash,attempted_at);
