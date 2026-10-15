ALTER TABLE notes ADD parent_note_id integer REFERENCES notes(id) ON DELETE SET NULL;
--> statement-breakpoint
ALTER TABLE note_person_shares ADD can_edit integer NOT NULL DEFAULT 0 CHECK(can_edit IN (0,1));
--> statement-breakpoint
ALTER TABLE note_group_shares ADD can_edit integer NOT NULL DEFAULT 0 CHECK(can_edit IN (0,1));
--> statement-breakpoint
CREATE TABLE note_workspaces (
 note_id integer PRIMARY KEY REFERENCES notes(id) ON DELETE CASCADE,
 state blob NOT NULL,
 revision integer NOT NULL DEFAULT 0,
 updated_at integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE note_workspace_versions (
 note_id integer NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
 revision integer NOT NULL,
 state blob NOT NULL,
 actor_user_id integer REFERENCES users(id) ON DELETE SET NULL,
 created_at integer NOT NULL,
 PRIMARY KEY(note_id, revision)
);
--> statement-breakpoint
CREATE INDEX note_workspace_versions_recent ON note_workspace_versions(note_id, created_at);
