CREATE TABLE `user_home_assets` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`owner_user_id` integer NOT NULL,
	`kind` text NOT NULL,
	`storage_name` text NOT NULL,
	`mime_type` text NOT NULL,
	`size_bytes` integer NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`owner_user_id`) REFERENCES `users`(`id`) ON UPDATE cascade ON DELETE cascade,
	CONSTRAINT "user_home_assets_kind_valid" CHECK("user_home_assets"."kind" = 'background'),
	CONSTRAINT "user_home_assets_mime_valid" CHECK("user_home_assets"."mime_type" in ('image/png', 'image/jpeg', 'image/webp')),
	CONSTRAINT "user_home_assets_size_valid" CHECK("user_home_assets"."size_bytes" > 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_home_assets_owner_kind_unique` ON `user_home_assets` (`owner_user_id`,`kind`);--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_users` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`display_name` text NOT NULL,
	`locale` text DEFAULT 'pt-BR' NOT NULL,
	`shortcuts_initialized` integer DEFAULT false NOT NULL,
	`today_widget_enabled` integer DEFAULT true NOT NULL,
	`theme` text DEFAULT 'dark' NOT NULL,
	`home_clock_enabled` integer DEFAULT true NOT NULL,
	`home_clock_position` text DEFAULT 'top-right' NOT NULL,
	`login` text NOT NULL,
	`password_hash` text NOT NULL,
	`role` text DEFAULT 'member' NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`last_login_at` integer,
	`password_changed_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	CONSTRAINT "users_display_name_nonempty" CHECK(length(trim("__new_users"."display_name")) > 0),
	CONSTRAINT "users_login_nonempty" CHECK(length(trim("__new_users"."login")) > 0),
	CONSTRAINT "users_role_valid" CHECK("__new_users"."role" in ('admin', 'member')),
	CONSTRAINT "users_locale_valid" CHECK("__new_users"."locale" in ('pt-BR', 'en')),
	CONSTRAINT "users_theme_valid" CHECK("__new_users"."theme" in ('dark', 'light')),
	CONSTRAINT "users_clock_position_valid" CHECK("__new_users"."home_clock_position" in ('top-left', 'top-right', 'bottom-left', 'bottom-right'))
);
--> statement-breakpoint
INSERT INTO `__new_users`("id", "display_name", "locale", "shortcuts_initialized", "today_widget_enabled", "theme", "home_clock_enabled", "home_clock_position", "login", "password_hash", "role", "active", "last_login_at", "password_changed_at", "created_at", "updated_at") SELECT "id", "display_name", "locale", "shortcuts_initialized", "today_widget_enabled", 'dark', 1, 'top-right', "login", "password_hash", "role", "active", "last_login_at", "password_changed_at", "created_at", "updated_at" FROM `users`;--> statement-breakpoint
DROP TABLE `users`;--> statement-breakpoint
ALTER TABLE `__new_users` RENAME TO `users`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `users_login_unique` ON `users` (`login`);--> statement-breakpoint
CREATE INDEX `users_role_active_idx` ON `users` (`role`,`active`);
