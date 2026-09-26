CREATE TABLE local_document_person_shares (
 document_id INTEGER NOT NULL REFERENCES local_documents(id) ON DELETE CASCADE,
 recipient_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 PRIMARY KEY(document_id,recipient_user_id)
);
CREATE TABLE local_document_group_shares (
 document_id INTEGER NOT NULL REFERENCES local_documents(id) ON DELETE CASCADE,
 group_legacy_id INTEGER NOT NULL,
 PRIMARY KEY(document_id,group_legacy_id)
);
