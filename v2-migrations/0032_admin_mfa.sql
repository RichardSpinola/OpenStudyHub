CREATE TABLE admin_mfa (
 admin_id INTEGER PRIMARY KEY REFERENCES admin_accounts(id) ON DELETE CASCADE,
 secret_encrypted TEXT,
 pending_encrypted TEXT,
 pending_expires_at INTEGER,
 last_step INTEGER NOT NULL DEFAULT -1,
 enabled_at INTEGER
);
CREATE TABLE admin_mfa_recovery (
 admin_id INTEGER NOT NULL REFERENCES admin_accounts(id) ON DELETE CASCADE,
 code_hash TEXT PRIMARY KEY,
 consumed_at INTEGER
);
CREATE TABLE admin_mfa_challenges (
 token_hash TEXT PRIMARY KEY,
 admin_id INTEGER NOT NULL REFERENCES admin_accounts(id) ON DELETE CASCADE,
 password_hash TEXT NOT NULL,
 expires_at INTEGER NOT NULL,
 attempts INTEGER NOT NULL DEFAULT 0 CHECK(attempts BETWEEN 0 AND 5)
);
CREATE INDEX admin_mfa_challenge_expiry ON admin_mfa_challenges(expires_at);
