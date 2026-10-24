CREATE TABLE `ai_config` (
	`id` integer PRIMARY KEY NOT NULL,
	`value_json` text NOT NULL,
	`credential_encrypted` text,
	`tested_hash` text,
	`revision` integer DEFAULT 0 NOT NULL,
	CONSTRAINT "ai_config_singleton" CHECK("ai_config"."id"=1)
);--> statement-breakpoint
CREATE TABLE `ai_conversations` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_user_id` integer NOT NULL,
	`group_id` integer,
	`room_id` integer,
	`title` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`owner_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`group_id`) REFERENCES `study_groups`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`room_id`) REFERENCES `chat_rooms`(`id`) ON UPDATE no action ON DELETE cascade
);--> statement-breakpoint
CREATE UNIQUE INDEX `ai_conversations_room_id_unique` ON `ai_conversations` (`room_id`);--> statement-breakpoint
CREATE TABLE `ai_messages` (
	`id` text PRIMARY KEY NOT NULL,
	`conversation_id` text NOT NULL,
	`author_user_id` integer,
	`role` text NOT NULL,
	`content` text NOT NULL,
	`status` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`conversation_id`) REFERENCES `ai_conversations`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`author_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "ai_message_role" CHECK("ai_messages"."role" IN ('user','assistant')),
	CONSTRAINT "ai_message_status" CHECK("ai_messages"."status" IN ('complete','pending','interrupted','error'))
);--> statement-breakpoint
CREATE INDEX `ai_message_history` ON `ai_messages` (`conversation_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `ai_participants` (
	`conversation_id` text NOT NULL,
	`user_id` integer NOT NULL,
	`joined_at` integer NOT NULL,
	PRIMARY KEY(`conversation_id`, `user_id`),
	FOREIGN KEY (`conversation_id`) REFERENCES `ai_conversations`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);--> statement-breakpoint
CREATE TABLE `ai_requests` (
	`id` text PRIMARY KEY NOT NULL,
	`conversation_id` text NOT NULL,
	`user_id` integer NOT NULL,
	`human_message_id` integer,
	`assistant_message_id` text NOT NULL,
	`status` text NOT NULL,
	`cancel_requested` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	`lease_until` integer,
	`config_revision` integer NOT NULL,
	FOREIGN KEY (`conversation_id`) REFERENCES `ai_conversations`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`human_message_id`) REFERENCES `chat_messages`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`assistant_message_id`) REFERENCES `ai_messages`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "ai_request_status" CHECK("ai_requests"."status" IN ('queued','running','complete','interrupted','error'))
);--> statement-breakpoint
CREATE UNIQUE INDEX `ai_requests_human_message_id_unique` ON `ai_requests` (`human_message_id`);--> statement-breakpoint
CREATE INDEX `ai_request_queue` ON `ai_requests` (`status`,`created_at`);--> statement-breakpoint
CREATE TABLE `ai_room_permissions` (
	`room_id` integer PRIMARY KEY NOT NULL,
	`enabled` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`room_id`) REFERENCES `chat_rooms`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "ai_room_enabled" CHECK("ai_room_permissions"."enabled" IN (0,1))
);--> statement-breakpoint
CREATE TABLE `ai_sources` (
	`id` text PRIMARY KEY NOT NULL,
	`conversation_id` text NOT NULL,
	`message_id` text NOT NULL,
	`kind` text NOT NULL,
	`reference` text,
	`title` text NOT NULL,
	`text_content` text NOT NULL,
	`asset_key` text,
	`mime` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`conversation_id`) REFERENCES `ai_conversations`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`message_id`) REFERENCES `ai_messages`(`id`) ON UPDATE no action ON DELETE cascade
);--> statement-breakpoint
CREATE TABLE `ai_upload_leases` (
	`user_id` integer PRIMARY KEY NOT NULL,
	`token` text NOT NULL,
	`expires_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);--> statement-breakpoint
CREATE UNIQUE INDEX `ai_upload_leases_token_unique` ON `ai_upload_leases` (`token`);
