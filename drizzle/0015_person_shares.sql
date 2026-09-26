CREATE TABLE `document_person_shares` (
	`document_id` integer NOT NULL,
	`recipient_user_id` integer NOT NULL,
	`shared_by_user_id` integer NOT NULL,
	`google_permission_status` text DEFAULT 'needs_authorization' NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	PRIMARY KEY(`document_id`, `recipient_user_id`),
	FOREIGN KEY (`document_id`) REFERENCES `generated_documents`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`recipient_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`shared_by_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE TABLE `note_person_shares` (
	`note_id` integer NOT NULL,
	`recipient_user_id` integer NOT NULL,
	`shared_by_user_id` integer NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	PRIMARY KEY(`note_id`, `recipient_user_id`),
	FOREIGN KEY (`note_id`) REFERENCES `notes`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`recipient_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`shared_by_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE restrict
);
