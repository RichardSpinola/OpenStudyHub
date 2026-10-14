CREATE TABLE project_shares_v2 (
 legacy_project_id INTEGER NOT NULL,
 owner_user_id INTEGER NOT NULL REFERENCES users(id),
 recipient_user_id INTEGER NOT NULL REFERENCES users(id),
 created_at INTEGER NOT NULL DEFAULT (unixepoch()*1000),
 PRIMARY KEY(legacy_project_id,recipient_user_id),
 CHECK(owner_user_id<>recipient_user_id)
);
