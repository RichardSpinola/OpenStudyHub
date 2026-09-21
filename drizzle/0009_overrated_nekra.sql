CREATE TABLE `classroom_feed_items` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`offering_id` integer NOT NULL,
	`type` text NOT NULL,
	`external_id` text NOT NULL,
	`title` text NOT NULL,
	`excerpt` text,
	`external_url` text,
	`published_at` integer,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE cascade ON DELETE cascade,
	FOREIGN KEY (`offering_id`) REFERENCES `subject_offerings`(`id`) ON UPDATE cascade ON DELETE cascade,
	CONSTRAINT "classroom_feed_items_type_valid" CHECK("classroom_feed_items"."type" in ('announcement', 'coursework', 'material')),
	CONSTRAINT "classroom_feed_items_title_nonempty" CHECK(length(trim("classroom_feed_items"."title")) > 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `classroom_feed_items_identity_unique` ON `classroom_feed_items` (`user_id`,`offering_id`,`type`,`external_id`);--> statement-breakpoint
CREATE INDEX `classroom_feed_items_timeline_idx` ON `classroom_feed_items` (`user_id`,`offering_id`,`published_at`);--> statement-breakpoint
CREATE TABLE `classroom_sync_states` (
	`user_id` integer NOT NULL,
	`offering_id` integer NOT NULL,
	`last_attempt_at` integer,
	`last_successful_sync_at` integer,
	`last_error_code` text,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	PRIMARY KEY(`user_id`, `offering_id`),
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE cascade ON DELETE cascade,
	FOREIGN KEY (`offering_id`) REFERENCES `subject_offerings`(`id`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `classroom_sync_states_stale_idx` ON `classroom_sync_states` (`last_successful_sync_at`);--> statement-breakpoint
CREATE TABLE `project_directories` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`project_id` integer NOT NULL,
	`relative_path` text NOT NULL,
	`drive_folder_id` text NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `project_directories_path_unique` ON `project_directories` (`project_id`,`relative_path`);--> statement-breakpoint
CREATE TABLE `project_files` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`project_id` integer NOT NULL,
	`relative_path` text NOT NULL,
	`sha256` text NOT NULL,
	`size_bytes` integer NOT NULL,
	`drive_file_id` text NOT NULL,
	`mime_type` text,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE cascade ON DELETE cascade,
	CONSTRAINT "project_files_size_valid" CHECK("project_files"."size_bytes" >= 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `project_files_path_unique` ON `project_files` (`project_id`,`relative_path`);--> statement-breakpoint
CREATE INDEX `project_files_drive_idx` ON `project_files` (`drive_file_id`);--> statement-breakpoint
CREATE TABLE `project_upload_previews` (
	`token` text PRIMARY KEY NOT NULL,
	`owner_user_id` integer NOT NULL,
	`project_id` integer NOT NULL,
	`base_version_number` integer,
	`temp_archive_path` text NOT NULL,
	`manifest_json` text NOT NULL,
	`ignored_json` text NOT NULL,
	`added_count` integer DEFAULT 0 NOT NULL,
	`modified_count` integer DEFAULT 0 NOT NULL,
	`removed_count` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`expires_at` integer NOT NULL,
	FOREIGN KEY (`owner_user_id`) REFERENCES `users`(`id`) ON UPDATE cascade ON DELETE cascade,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE cascade ON DELETE cascade,
	CONSTRAINT "project_upload_previews_counts_valid" CHECK("project_upload_previews"."added_count" >= 0 and "project_upload_previews"."modified_count" >= 0 and "project_upload_previews"."removed_count" >= 0)
);
--> statement-breakpoint
CREATE INDEX `project_upload_previews_expiry_idx` ON `project_upload_previews` (`expires_at`);--> statement-breakpoint
CREATE TABLE `project_versions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`project_id` integer NOT NULL,
	`version_number` integer NOT NULL,
	`base_version_number` integer,
	`message` text,
	`archive_drive_file_id` text NOT NULL,
	`manifest_json` text NOT NULL,
	`added_count` integer DEFAULT 0 NOT NULL,
	`modified_count` integer DEFAULT 0 NOT NULL,
	`removed_count` integer DEFAULT 0 NOT NULL,
	`created_by_user_id` integer NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE cascade ON DELETE cascade,
	FOREIGN KEY (`created_by_user_id`) REFERENCES `users`(`id`) ON UPDATE cascade ON DELETE restrict,
	CONSTRAINT "project_versions_number_valid" CHECK("project_versions"."version_number" > 0),
	CONSTRAINT "project_versions_counts_valid" CHECK("project_versions"."added_count" >= 0 and "project_versions"."modified_count" >= 0 and "project_versions"."removed_count" >= 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `project_versions_number_unique` ON `project_versions` (`project_id`,`version_number`);--> statement-breakpoint
CREATE INDEX `project_versions_created_idx` ON `project_versions` (`project_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `projects` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`owner_user_id` integer NOT NULL,
	`offering_id` integer NOT NULL,
	`name` text NOT NULL,
	`language` text NOT NULL,
	`ignore_preset` text NOT NULL,
	`description` text,
	`drive_project_folder_id` text,
	`drive_current_folder_id` text,
	`drive_versions_folder_id` text,
	`current_version_number` integer DEFAULT 0 NOT NULL,
	`sync_status` text DEFAULT 'prepared' NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`archived_at` integer,
	FOREIGN KEY (`owner_user_id`) REFERENCES `users`(`id`) ON UPDATE cascade ON DELETE cascade,
	FOREIGN KEY (`offering_id`) REFERENCES `subject_offerings`(`id`) ON UPDATE cascade ON DELETE restrict,
	CONSTRAINT "projects_name_nonempty" CHECK(length(trim("projects"."name")) > 0),
	CONSTRAINT "projects_sync_status_valid" CHECK("projects"."sync_status" in ('prepared', 'syncing', 'complete', 'failed')),
	CONSTRAINT "projects_version_nonnegative" CHECK("projects"."current_version_number" >= 0)
);
--> statement-breakpoint
CREATE INDEX `projects_owner_offering_idx` ON `projects` (`owner_user_id`,`offering_id`,`archived_at`);--> statement-breakpoint
CREATE TABLE `storage_settings` (
	`id` integer PRIMARY KEY DEFAULT 1 NOT NULL,
	`include_cohort` integer DEFAULT true NOT NULL,
	`patterns_json` text NOT NULL,
	`categories_json` text NOT NULL,
	`updated_by_user_id` integer,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`updated_by_user_id`) REFERENCES `users`(`id`) ON UPDATE cascade ON DELETE set null
);
