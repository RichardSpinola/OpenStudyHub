CREATE TABLE `curator_cohort_scopes` (
	`user_id` integer NOT NULL,
	`cohort_id` integer NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	PRIMARY KEY(`user_id`, `cohort_id`),
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE cascade ON DELETE cascade,
	FOREIGN KEY (`cohort_id`) REFERENCES `cohorts`(`id`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `curator_cohort_scopes_cohort_idx` ON `curator_cohort_scopes` (`cohort_id`);--> statement-breakpoint
CREATE TABLE `moderator_program_scopes` (
	`user_id` integer NOT NULL,
	`program_id` integer NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	PRIMARY KEY(`user_id`, `program_id`),
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE cascade ON DELETE cascade,
	FOREIGN KEY (`program_id`) REFERENCES `programs`(`id`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `moderator_program_scopes_program_idx` ON `moderator_program_scopes` (`program_id`);