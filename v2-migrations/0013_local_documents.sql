CREATE TABLE local_documents (
 id INTEGER PRIMARY KEY,
 user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 offering_legacy_id INTEGER,
 name TEXT NOT NULL,
 mime_type TEXT NOT NULL CHECK(mime_type IN ('application/pdf','application/vnd.openxmlformats-officedocument.wordprocessingml.document','text/plain')),
 content BLOB NOT NULL,
 size_bytes INTEGER NOT NULL CHECK(size_bytes>0 AND size_bytes<=10485760),
 created_at INTEGER NOT NULL,
 updated_at INTEGER NOT NULL
);
CREATE INDEX local_documents_user_updated_idx ON local_documents(user_id,updated_at DESC);
