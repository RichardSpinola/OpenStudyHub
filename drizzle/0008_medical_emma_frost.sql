CREATE TABLE `document_template_sections` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`template_id` integer NOT NULL,
	`internal_key` text NOT NULL,
	`display_title` text NOT NULL,
	`type` text DEFAULT 'text' NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`optional` integer DEFAULT false NOT NULL,
	`initial_source` text,
	`helper_text` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`template_id`) REFERENCES `document_templates`(`id`) ON UPDATE cascade ON DELETE cascade,
	CONSTRAINT "document_template_sections_key_nonempty" CHECK(length(trim("document_template_sections"."internal_key")) > 0),
	CONSTRAINT "document_template_sections_title_nonempty" CHECK(length(trim("document_template_sections"."display_title")) > 0),
	CONSTRAINT "document_template_sections_type_valid" CHECK("document_template_sections"."type" in ('text', 'code', 'text_or_image'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `document_template_sections_key_unique` ON `document_template_sections` (`template_id`,`internal_key`);--> statement-breakpoint
CREATE INDEX `document_template_sections_order_idx` ON `document_template_sections` (`template_id`,`sort_order`,`id`);--> statement-breakpoint
CREATE TABLE `document_templates` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`owner_user_id` integer NOT NULL,
	`base_template_id` integer,
	`name` text NOT NULL,
	`description` text,
	`source_file_id` text NOT NULL,
	`naming_pattern` text NOT NULL,
	`destination_strategy` text DEFAULT 'offering_drive_folder' NOT NULL,
	`required_placeholders` text DEFAULT '[]' NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`owner_user_id`) REFERENCES `users`(`id`) ON UPDATE cascade ON DELETE cascade,
	FOREIGN KEY (`base_template_id`) REFERENCES `document_templates`(`id`) ON UPDATE cascade ON DELETE set null,
	CONSTRAINT "document_templates_name_nonempty" CHECK(length(trim("document_templates"."name")) > 0),
	CONSTRAINT "document_templates_source_nonempty" CHECK(length(trim("document_templates"."source_file_id")) > 0),
	CONSTRAINT "document_templates_destination_valid" CHECK("document_templates"."destination_strategy" = 'offering_drive_folder')
);
--> statement-breakpoint
CREATE INDEX `document_templates_owner_active_idx` ON `document_templates` (`owner_user_id`,`active`,`name`);--> statement-breakpoint
CREATE TABLE `generated_documents` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`owner_user_id` integer NOT NULL,
	`template_id` integer,
	`offering_id` integer NOT NULL,
	`activity_id` integer,
	`drive_file_id` text NOT NULL,
	`web_view_link` text NOT NULL,
	`name` text NOT NULL,
	`google_modified_at` integer,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`owner_user_id`) REFERENCES `users`(`id`) ON UPDATE cascade ON DELETE cascade,
	FOREIGN KEY (`template_id`) REFERENCES `document_templates`(`id`) ON UPDATE cascade ON DELETE set null,
	FOREIGN KEY (`offering_id`) REFERENCES `subject_offerings`(`id`) ON UPDATE cascade ON DELETE restrict,
	FOREIGN KEY (`activity_id`) REFERENCES `activities`(`id`) ON UPDATE cascade ON DELETE set null,
	CONSTRAINT "generated_documents_name_nonempty" CHECK(length(trim("generated_documents"."name")) > 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `generated_documents_owner_drive_unique` ON `generated_documents` (`owner_user_id`,`drive_file_id`);--> statement-breakpoint
CREATE INDEX `generated_documents_owner_created_idx` ON `generated_documents` (`owner_user_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `generated_documents_offering_idx` ON `generated_documents` (`offering_id`);--> statement-breakpoint
CREATE TABLE `notes` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`owner_user_id` integer NOT NULL,
	`offering_id` integer,
	`activity_id` integer,
	`title` text NOT NULL,
	`content` text DEFAULT '' NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`owner_user_id`) REFERENCES `users`(`id`) ON UPDATE cascade ON DELETE cascade,
	FOREIGN KEY (`offering_id`) REFERENCES `subject_offerings`(`id`) ON UPDATE cascade ON DELETE set null,
	FOREIGN KEY (`activity_id`) REFERENCES `activities`(`id`) ON UPDATE cascade ON DELETE set null,
	CONSTRAINT "notes_title_nonempty" CHECK(length(trim("notes"."title")) > 0)
);
--> statement-breakpoint
CREATE INDEX `notes_owner_updated_idx` ON `notes` (`owner_user_id`,`updated_at`);--> statement-breakpoint
CREATE INDEX `notes_owner_offering_idx` ON `notes` (`owner_user_id`,`offering_id`);--> statement-breakpoint
CREATE INDEX `notes_owner_activity_idx` ON `notes` (`owner_user_id`,`activity_id`);