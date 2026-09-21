ALTER TABLE `document_templates` ADD `storage_user_id` integer REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE;--> statement-breakpoint
CREATE INDEX `document_templates_storage_user_idx` ON `document_templates` (`storage_user_id`);--> statement-breakpoint
ALTER TABLE `generated_documents` ADD `storage_user_id` integer REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE `generated_documents` ADD `google_permission_status` text DEFAULT 'not_requested' NOT NULL;--> statement-breakpoint
CREATE INDEX `generated_documents_storage_user_idx` ON `generated_documents` (`storage_user_id`);--> statement-breakpoint
ALTER TABLE `offering_google_integrations` ADD `drive_storage_user_id` integer REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE;--> statement-breakpoint
CREATE INDEX `offering_google_drive_storage_user_idx` ON `offering_google_integrations` (`drive_storage_user_id`);
--> statement-breakpoint
UPDATE `document_templates`
SET `storage_user_id` = `owner_user_id`
WHERE `storage_user_id` IS NULL;
--> statement-breakpoint
UPDATE `generated_documents`
SET `storage_user_id` = `owner_user_id`
WHERE `storage_user_id` IS NULL;
--> statement-breakpoint
UPDATE `offering_google_integrations`
SET `drive_storage_user_id` = `updated_by_user_id`
WHERE `drive_folder_id` IS NOT NULL
  AND `drive_storage_user_id` IS NULL;
