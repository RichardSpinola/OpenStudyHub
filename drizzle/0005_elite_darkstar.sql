CREATE TABLE `cohorts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`program_id` integer NOT NULL,
	`code` text,
	`name` text NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`program_id`) REFERENCES `programs`(`id`) ON UPDATE cascade ON DELETE restrict,
	CONSTRAINT "cohorts_name_nonempty" CHECK(length(trim("cohorts"."name")) > 0)
);
--> statement-breakpoint
CREATE INDEX `cohorts_program_active_idx` ON `cohorts` (`program_id`,`active`,`name`);--> statement-breakpoint
CREATE UNIQUE INDEX `cohorts_program_code_unique` ON `cohorts` (`program_id`,`code`);--> statement-breakpoint
CREATE TABLE `user_academic_memberships` (
	`user_id` integer PRIMARY KEY NOT NULL,
	`program_id` integer NOT NULL,
	`cohort_id` integer,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE cascade ON DELETE cascade,
	FOREIGN KEY (`program_id`) REFERENCES `programs`(`id`) ON UPDATE cascade ON DELETE restrict,
	FOREIGN KEY (`cohort_id`) REFERENCES `cohorts`(`id`) ON UPDATE cascade ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `user_academic_memberships_program_idx` ON `user_academic_memberships` (`program_id`);--> statement-breakpoint
CREATE INDEX `user_academic_memberships_cohort_idx` ON `user_academic_memberships` (`cohort_id`);