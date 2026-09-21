CREATE TABLE `activities` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`offering_id` integer NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`due_at` integer,
	`status` text DEFAULT 'pending' NOT NULL,
	`origin` text DEFAULT 'local' NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE cascade ON DELETE cascade,
	FOREIGN KEY (`offering_id`) REFERENCES `subject_offerings`(`id`) ON UPDATE cascade ON DELETE restrict,
	CONSTRAINT "activities_title_nonempty" CHECK(length(trim("activities"."title")) > 0),
	CONSTRAINT "activities_status_valid" CHECK("activities"."status" in ('pending', 'in_progress', 'completed', 'submitted', 'archived')),
	CONSTRAINT "activities_origin_valid" CHECK("activities"."origin" in ('local', 'external'))
);
--> statement-breakpoint
CREATE INDEX `activities_user_status_due_idx` ON `activities` (`user_id`,`status`,`due_at`);--> statement-breakpoint
CREATE INDEX `activities_offering_idx` ON `activities` (`offering_id`);--> statement-breakpoint
CREATE TABLE `enrollments` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`offering_id` integer NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE cascade ON DELETE cascade,
	FOREIGN KEY (`offering_id`) REFERENCES `subject_offerings`(`id`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `enrollments_user_offering_unique` ON `enrollments` (`user_id`,`offering_id`);--> statement-breakpoint
CREATE INDEX `enrollments_offering_idx` ON `enrollments` (`offering_id`);--> statement-breakpoint
ALTER TABLE `users` ADD `today_widget_enabled` integer DEFAULT true NOT NULL;