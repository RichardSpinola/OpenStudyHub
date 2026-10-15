CREATE TABLE `project_group_shares` (
	`project_id` integer NOT NULL,
	`group_id` integer NOT NULL,
	PRIMARY KEY(`project_id`, `group_id`),
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`group_id`) REFERENCES `study_groups`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `project_upload_claims` (
	`token` text PRIMARY KEY NOT NULL,
	`claim_id` text NOT NULL,
	`project_id` integer NOT NULL,
	`owner_user_id` integer NOT NULL,
	`claimed_at` integer NOT NULL,
	`heartbeat_at` integer NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`owner_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `project_upload_claims_project_id_unique` ON `project_upload_claims` (`project_id`);--> statement-breakpoint
CREATE TABLE `project_upload_receipts` (
	`token` text PRIMARY KEY NOT NULL,
	`project_id` integer NOT NULL,
	`owner_user_id` integer NOT NULL,
	`version_number` integer NOT NULL,
	`result_json` text NOT NULL,
	`completed_at` integer NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`owner_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
ALTER TABLE `projects` ADD `storage_backend` text DEFAULT 'google-drive' NOT NULL;