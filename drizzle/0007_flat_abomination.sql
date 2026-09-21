CREATE TABLE `google_connections` (
	`user_id` integer PRIMARY KEY NOT NULL,
	`google_subject` text NOT NULL,
	`account_email` text,
	`encrypted_refresh_token` text,
	`granted_scopes` text NOT NULL,
	`status` text DEFAULT 'connected' NOT NULL,
	`drive_root_folder_id` text,
	`connected_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE cascade ON DELETE cascade,
	CONSTRAINT "google_connections_status_valid" CHECK("google_connections"."status" in ('connected', 'revoked'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `google_connections_subject_unique` ON `google_connections` (`google_subject`);--> statement-breakpoint
CREATE TABLE `google_oauth_states` (
	`state_hash` text PRIMARY KEY NOT NULL,
	`user_id` integer NOT NULL,
	`encrypted_code_verifier` text NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `google_oauth_states_user_idx` ON `google_oauth_states` (`user_id`);--> statement-breakpoint
CREATE INDEX `google_oauth_states_expiry_idx` ON `google_oauth_states` (`expires_at`);--> statement-breakpoint
CREATE TABLE `offering_google_integrations` (
	`offering_id` integer PRIMARY KEY NOT NULL,
	`drive_folder_id` text,
	`drive_folder_name` text,
	`notebook_url` text,
	`classroom_course_id` text,
	`classroom_course_name` text,
	`updated_by_user_id` integer,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`offering_id`) REFERENCES `subject_offerings`(`id`) ON UPDATE cascade ON DELETE cascade,
	FOREIGN KEY (`updated_by_user_id`) REFERENCES `users`(`id`) ON UPDATE cascade ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `offering_google_drive_folder_idx` ON `offering_google_integrations` (`drive_folder_id`);--> statement-breakpoint
CREATE INDEX `offering_google_classroom_course_idx` ON `offering_google_integrations` (`classroom_course_id`);--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_activities` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`offering_id` integer NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`due_at` integer,
	`status` text DEFAULT 'pending' NOT NULL,
	`origin` text DEFAULT 'local' NOT NULL,
	`external_source` text,
	`external_id` text,
	`external_url` text,
	`external_updated_at` integer,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE cascade ON DELETE cascade,
	FOREIGN KEY (`offering_id`) REFERENCES `subject_offerings`(`id`) ON UPDATE cascade ON DELETE restrict,
	CONSTRAINT "activities_title_nonempty" CHECK(length(trim("__new_activities"."title")) > 0),
	CONSTRAINT "activities_status_valid" CHECK("__new_activities"."status" in ('pending', 'in_progress', 'completed', 'submitted', 'archived')),
	CONSTRAINT "activities_origin_valid" CHECK("__new_activities"."origin" in ('local', 'external')),
	CONSTRAINT "activities_external_source_valid" CHECK("__new_activities"."external_source" is null or "__new_activities"."external_source" = 'classroom'),
	CONSTRAINT "activities_external_identity_valid" CHECK(("__new_activities"."origin" = 'local' and "__new_activities"."external_source" is null and "__new_activities"."external_id" is null) or ("__new_activities"."origin" = 'external' and (("__new_activities"."external_source" is null and "__new_activities"."external_id" is null) or ("__new_activities"."external_source" is not null and "__new_activities"."external_id" is not null))))
);
--> statement-breakpoint
INSERT INTO `__new_activities`("id", "user_id", "offering_id", "title", "description", "due_at", "status", "origin", "external_source", "external_id", "external_url", "external_updated_at", "created_at", "updated_at") SELECT "id", "user_id", "offering_id", "title", "description", "due_at", "status", "origin", NULL, NULL, NULL, NULL, "created_at", "updated_at" FROM `activities`;--> statement-breakpoint
DROP TABLE `activities`;--> statement-breakpoint
ALTER TABLE `__new_activities` RENAME TO `activities`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `activities_user_status_due_idx` ON `activities` (`user_id`,`status`,`due_at`);--> statement-breakpoint
CREATE INDEX `activities_offering_idx` ON `activities` (`offering_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `activities_external_identity_unique` ON `activities` (`user_id`,`external_source`,`external_id`);
