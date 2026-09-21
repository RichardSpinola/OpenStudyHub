ALTER TABLE `users` ADD `locale` text DEFAULT 'pt-BR' NOT NULL
  CHECK (`locale` in ('pt-BR', 'en'));--> statement-breakpoint
UPDATE `users`
SET `locale` = CASE
  WHEN (SELECT `value` FROM `app_settings` WHERE `key` = 'ui.language') IN ('pt-BR', 'en')
    THEN (SELECT `value` FROM `app_settings` WHERE `key` = 'ui.language')
  ELSE 'pt-BR'
END;--> statement-breakpoint
ALTER TABLE `users` ADD `shortcuts_initialized` integer DEFAULT false NOT NULL;--> statement-breakpoint
CREATE TABLE `user_shortcuts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`name` text NOT NULL,
	`url` text NOT NULL,
	`icon` text,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`enabled` integer DEFAULT true NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `user_shortcuts_user_order_idx` ON `user_shortcuts` (`user_id`,`sort_order`,`id`);
