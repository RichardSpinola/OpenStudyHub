PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_document_templates` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`owner_user_id` integer NOT NULL,
	`storage_user_id` integer,
	`base_template_id` integer,
	`name` text NOT NULL,
	`description` text,
	`category_kind` text DEFAULT 'documents' NOT NULL,
	`source_file_id` text NOT NULL,
	`naming_pattern` text NOT NULL,
	`destination_strategy` text DEFAULT 'offering_drive_folder' NOT NULL,
	`required_placeholders` text DEFAULT '[]' NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`owner_user_id`) REFERENCES `users`(`id`) ON UPDATE cascade ON DELETE cascade,
	FOREIGN KEY (`storage_user_id`) REFERENCES `users`(`id`) ON UPDATE cascade ON DELETE set null,
	FOREIGN KEY (`base_template_id`) REFERENCES `document_templates`(`id`) ON UPDATE cascade ON DELETE set null,
	CONSTRAINT "document_templates_name_nonempty" CHECK(length(trim("__new_document_templates"."name")) > 0),
	CONSTRAINT "document_templates_source_nonempty" CHECK(length(trim("__new_document_templates"."source_file_id")) > 0),
	CONSTRAINT "document_templates_category_valid" CHECK("__new_document_templates"."category_kind" in ('activity', 'notes', 'documents', 'custom')),
	CONSTRAINT "document_templates_destination_valid" CHECK("__new_document_templates"."destination_strategy" = 'offering_drive_folder')
);
--> statement-breakpoint
INSERT INTO `__new_document_templates`("id", "owner_user_id", "storage_user_id", "base_template_id", "name", "description", "category_kind", "source_file_id", "naming_pattern", "destination_strategy", "required_placeholders", "active", "created_at", "updated_at") SELECT "id", "owner_user_id", "storage_user_id", "base_template_id", "name", "description", 'documents', "source_file_id", "naming_pattern", "destination_strategy", "required_placeholders", "active", "created_at", "updated_at" FROM `document_templates`;--> statement-breakpoint
DROP TABLE `document_templates`;--> statement-breakpoint
ALTER TABLE `__new_document_templates` RENAME TO `document_templates`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `document_templates_owner_active_idx` ON `document_templates` (`owner_user_id`,`active`,`name`);--> statement-breakpoint
CREATE INDEX `document_templates_storage_user_idx` ON `document_templates` (`storage_user_id`);
