CREATE TABLE `chat_attachments` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`message_id` integer NOT NULL,
	`owner_user_id` integer NOT NULL,
	`storage_name` text NOT NULL,
	`mime_type` text NOT NULL,
	`size_bytes` integer NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`message_id`) REFERENCES `chat_messages`(`id`) ON UPDATE cascade ON DELETE cascade,
	FOREIGN KEY (`owner_user_id`) REFERENCES `users`(`id`) ON UPDATE cascade ON DELETE cascade,
	CONSTRAINT "chat_attachments_size_valid" CHECK("chat_attachments"."size_bytes" > 0)
);
--> statement-breakpoint
CREATE INDEX `chat_attachments_message_idx` ON `chat_attachments` (`message_id`);--> statement-breakpoint
CREATE TABLE `chat_direct_members` (
	`room_id` integer NOT NULL,
	`user_id` integer NOT NULL,
	PRIMARY KEY(`room_id`, `user_id`),
	FOREIGN KEY (`room_id`) REFERENCES `chat_rooms`(`id`) ON UPDATE cascade ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `chat_direct_members_user_idx` ON `chat_direct_members` (`user_id`);--> statement-breakpoint
CREATE TABLE `chat_message_mentions` (
	`message_id` integer NOT NULL,
	`mentioned_user_id` integer NOT NULL,
	PRIMARY KEY(`message_id`, `mentioned_user_id`),
	FOREIGN KEY (`message_id`) REFERENCES `chat_messages`(`id`) ON UPDATE cascade ON DELETE cascade,
	FOREIGN KEY (`mentioned_user_id`) REFERENCES `users`(`id`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `chat_messages` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`room_id` integer NOT NULL,
	`author_user_id` integer NOT NULL,
	`body_source` text NOT NULL,
	`reply_to_message_id` integer,
	`edited_at` integer,
	`deleted_at` integer,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`room_id`) REFERENCES `chat_rooms`(`id`) ON UPDATE cascade ON DELETE cascade,
	FOREIGN KEY (`author_user_id`) REFERENCES `users`(`id`) ON UPDATE cascade ON DELETE restrict,
	FOREIGN KEY (`reply_to_message_id`) REFERENCES `chat_messages`(`id`) ON UPDATE cascade ON DELETE set null,
	CONSTRAINT "chat_messages_body_size" CHECK(length("chat_messages"."body_source") <= 10000)
);
--> statement-breakpoint
CREATE INDEX `chat_messages_room_cursor_idx` ON `chat_messages` (`room_id`,`id`);--> statement-breakpoint
CREATE TABLE `chat_room_audiences` (
	`room_id` integer NOT NULL,
	`audience_type` text NOT NULL,
	`program_id` integer,
	`cohort_id` integer,
	FOREIGN KEY (`room_id`) REFERENCES `chat_rooms`(`id`) ON UPDATE cascade ON DELETE cascade,
	FOREIGN KEY (`program_id`) REFERENCES `programs`(`id`) ON UPDATE cascade ON DELETE cascade,
	FOREIGN KEY (`cohort_id`) REFERENCES `cohorts`(`id`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `chat_room_audience_unique` ON `chat_room_audiences` (`room_id`,`audience_type`,`program_id`,`cohort_id`);--> statement-breakpoint
CREATE TABLE `chat_rooms` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`kind` text NOT NULL,
	`name` text,
	`group_id` integer,
	`created_by_user_id` integer NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`archived_at` integer,
	FOREIGN KEY (`group_id`) REFERENCES `study_groups`(`id`) ON UPDATE cascade ON DELETE cascade,
	FOREIGN KEY (`created_by_user_id`) REFERENCES `users`(`id`) ON UPDATE cascade ON DELETE restrict,
	CONSTRAINT "chat_rooms_kind_valid" CHECK("chat_rooms"."kind" in ('direct', 'group', 'audience'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `chat_rooms_group_unique` ON `chat_rooms` (`group_id`);--> statement-breakpoint
CREATE TABLE `document_group_shares` (
	`document_id` integer NOT NULL,
	`group_id` integer NOT NULL,
	`shared_by_user_id` integer NOT NULL,
	`google_permission_status` text DEFAULT 'not_requested' NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	PRIMARY KEY(`document_id`, `group_id`),
	FOREIGN KEY (`document_id`) REFERENCES `generated_documents`(`id`) ON UPDATE cascade ON DELETE cascade,
	FOREIGN KEY (`group_id`) REFERENCES `study_groups`(`id`) ON UPDATE cascade ON DELETE cascade,
	FOREIGN KEY (`shared_by_user_id`) REFERENCES `users`(`id`) ON UPDATE cascade ON DELETE restrict
);
--> statement-breakpoint
CREATE TABLE `note_group_shares` (
	`note_id` integer NOT NULL,
	`group_id` integer NOT NULL,
	`shared_by_user_id` integer NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	PRIMARY KEY(`note_id`, `group_id`),
	FOREIGN KEY (`note_id`) REFERENCES `notes`(`id`) ON UPDATE cascade ON DELETE cascade,
	FOREIGN KEY (`group_id`) REFERENCES `study_groups`(`id`) ON UPDATE cascade ON DELETE cascade,
	FOREIGN KEY (`shared_by_user_id`) REFERENCES `users`(`id`) ON UPDATE cascade ON DELETE restrict
);
--> statement-breakpoint
CREATE TABLE `notifications` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`type` text NOT NULL,
	`actor_user_id` integer,
	`entity_type` text NOT NULL,
	`entity_id` text NOT NULL,
	`title` text NOT NULL,
	`body_preview` text,
	`read_at` integer,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE cascade ON DELETE cascade,
	FOREIGN KEY (`actor_user_id`) REFERENCES `users`(`id`) ON UPDATE cascade ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `notifications_user_unread_idx` ON `notifications` (`user_id`,`read_at`,`id`);--> statement-breakpoint
CREATE TABLE `profile_tags` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`label` text NOT NULL,
	`scope_type` text NOT NULL,
	`program_id` integer,
	`cohort_id` integer,
	`self_assignable` integer DEFAULT false NOT NULL,
	`created_by_user_id` integer NOT NULL,
	`archived_at` integer,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`program_id`) REFERENCES `programs`(`id`) ON UPDATE cascade ON DELETE cascade,
	FOREIGN KEY (`cohort_id`) REFERENCES `cohorts`(`id`) ON UPDATE cascade ON DELETE cascade,
	FOREIGN KEY (`created_by_user_id`) REFERENCES `users`(`id`) ON UPDATE cascade ON DELETE restrict,
	CONSTRAINT "profile_tags_label_nonempty" CHECK(length(trim("profile_tags"."label")) > 0)
);
--> statement-breakpoint
CREATE INDEX `profile_tags_scope_idx` ON `profile_tags` (`scope_type`,`program_id`,`cohort_id`);--> statement-breakpoint
CREATE TABLE `study_group_members` (
	`group_id` integer NOT NULL,
	`user_id` integer NOT NULL,
	`member_role` text DEFAULT 'member' NOT NULL,
	`joined_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	PRIMARY KEY(`group_id`, `user_id`),
	FOREIGN KEY (`group_id`) REFERENCES `study_groups`(`id`) ON UPDATE cascade ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE cascade ON DELETE cascade,
	CONSTRAINT "study_group_members_role_valid" CHECK("study_group_members"."member_role" in ('owner', 'member'))
);
--> statement-breakpoint
CREATE INDEX `study_group_members_user_idx` ON `study_group_members` (`user_id`);--> statement-breakpoint
CREATE TABLE `study_groups` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`subject_offering_id` integer,
	`created_by_user_id` integer NOT NULL,
	`archived_at` integer,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`subject_offering_id`) REFERENCES `subject_offerings`(`id`) ON UPDATE cascade ON DELETE set null,
	FOREIGN KEY (`created_by_user_id`) REFERENCES `users`(`id`) ON UPDATE cascade ON DELETE restrict,
	CONSTRAINT "study_groups_name_nonempty" CHECK(length(trim("study_groups"."name")) > 0)
);
--> statement-breakpoint
CREATE INDEX `study_groups_offering_idx` ON `study_groups` (`subject_offering_id`);--> statement-breakpoint
CREATE TABLE `user_profile_tags` (
	`user_id` integer NOT NULL,
	`tag_id` integer NOT NULL,
	`assigned_by_user_id` integer NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	PRIMARY KEY(`user_id`, `tag_id`),
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE cascade ON DELETE cascade,
	FOREIGN KEY (`tag_id`) REFERENCES `profile_tags`(`id`) ON UPDATE cascade ON DELETE cascade,
	FOREIGN KEY (`assigned_by_user_id`) REFERENCES `users`(`id`) ON UPDATE cascade ON DELETE restrict
);
--> statement-breakpoint
ALTER TABLE `notes` ADD `drive_file_id` text;--> statement-breakpoint
ALTER TABLE `shortcuts` ADD `icon_storage_name` text;--> statement-breakpoint
ALTER TABLE `shortcuts` ADD `icon_mime_type` text;--> statement-breakpoint
ALTER TABLE `user_shortcuts` ADD `icon_storage_name` text;--> statement-breakpoint
ALTER TABLE `user_shortcuts` ADD `icon_mime_type` text;--> statement-breakpoint
ALTER TABLE `users` ADD `bio` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `avatar_storage_name` text;--> statement-breakpoint
ALTER TABLE `users` ADD `avatar_mime_type` text;--> statement-breakpoint
ALTER TABLE `users` ADD `banner_storage_name` text;--> statement-breakpoint
ALTER TABLE `users` ADD `banner_mime_type` text;--> statement-breakpoint
ALTER TABLE `users` ADD `onboarding_version` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
UPDATE `users` SET `onboarding_version` = 1;--> statement-breakpoint
ALTER TABLE `users` ADD `notification_preferences_json` text DEFAULT '{"desktopEnabled":false,"dm":"all","groupDefault":"mentions","audienceDefault":"mentions","mentionsEnabled":true,"repliesEnabled":true}' NOT NULL;
