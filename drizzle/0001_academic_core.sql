CREATE TABLE `academic_periods` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`label` text NOT NULL,
	`starts_on` text NOT NULL,
	`ends_on` text NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	CONSTRAINT "academic_periods_label_nonempty" CHECK(length(trim("academic_periods"."label")) > 0),
	CONSTRAINT "academic_periods_date_order" CHECK("academic_periods"."starts_on" <= "academic_periods"."ends_on")
);
--> statement-breakpoint
CREATE UNIQUE INDEX `academic_periods_label_unique` ON `academic_periods` (`label`);--> statement-breakpoint
CREATE INDEX `academic_periods_dates_idx` ON `academic_periods` (`starts_on`,`ends_on`);--> statement-breakpoint
CREATE TABLE `instructors` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`code` text,
	`name` text NOT NULL,
	`display_name` text,
	`active` integer DEFAULT true NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	CONSTRAINT "instructors_name_nonempty" CHECK(length(trim("instructors"."name")) > 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `instructors_code_unique` ON `instructors` (`code`);--> statement-breakpoint
CREATE INDEX `instructors_active_name_idx` ON `instructors` (`active`,`name`);--> statement-breakpoint
CREATE TABLE `locations` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`campus` text,
	`building` text,
	`room` text,
	`description` text,
	`active` integer DEFAULT true NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	CONSTRAINT "locations_name_nonempty" CHECK(length(trim("locations"."name")) > 0)
);
--> statement-breakpoint
CREATE INDEX `locations_active_name_idx` ON `locations` (`active`,`name`);--> statement-breakpoint
CREATE TABLE `programs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`code` text,
	`name` text NOT NULL,
	`short_name` text,
	`active` integer DEFAULT true NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	CONSTRAINT "programs_name_nonempty" CHECK(length(trim("programs"."name")) > 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `programs_code_unique` ON `programs` (`code`);--> statement-breakpoint
CREATE INDEX `programs_active_name_idx` ON `programs` (`active`,`name`);--> statement-breakpoint
CREATE TABLE `schedule_slots` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`offering_id` integer NOT NULL,
	`location_id` integer,
	`weekday` integer NOT NULL,
	`starts_at_minutes` integer NOT NULL,
	`ends_at_minutes` integer NOT NULL,
	`valid_from` text,
	`valid_until` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`offering_id`) REFERENCES `subject_offerings`(`id`) ON UPDATE cascade ON DELETE cascade,
	FOREIGN KEY (`location_id`) REFERENCES `locations`(`id`) ON UPDATE cascade ON DELETE set null,
	CONSTRAINT "schedule_slots_weekday_valid" CHECK("schedule_slots"."weekday" between 1 and 7),
	CONSTRAINT "schedule_slots_time_valid" CHECK("schedule_slots"."starts_at_minutes" between 0 and 1439 and "schedule_slots"."ends_at_minutes" between 1 and 1440 and "schedule_slots"."starts_at_minutes" < "schedule_slots"."ends_at_minutes"),
	CONSTRAINT "schedule_slots_validity_order" CHECK("schedule_slots"."valid_from" is null or "schedule_slots"."valid_until" is null or "schedule_slots"."valid_from" <= "schedule_slots"."valid_until")
);
--> statement-breakpoint
CREATE INDEX `schedule_slots_agenda_idx` ON `schedule_slots` (`weekday`,`starts_at_minutes`,`ends_at_minutes`);--> statement-breakpoint
CREATE INDEX `schedule_slots_offering_idx` ON `schedule_slots` (`offering_id`);--> statement-breakpoint
CREATE INDEX `schedule_slots_location_idx` ON `schedule_slots` (`location_id`);--> statement-breakpoint
CREATE TABLE `subject_offerings` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`subject_id` integer NOT NULL,
	`program_id` integer NOT NULL,
	`academic_period_id` integer NOT NULL,
	`instructor_id` integer,
	`class_group` text,
	`curriculum_term` text,
	`status` text DEFAULT 'planned' NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`subject_id`) REFERENCES `subjects`(`id`) ON UPDATE cascade ON DELETE restrict,
	FOREIGN KEY (`program_id`) REFERENCES `programs`(`id`) ON UPDATE cascade ON DELETE restrict,
	FOREIGN KEY (`academic_period_id`) REFERENCES `academic_periods`(`id`) ON UPDATE cascade ON DELETE restrict,
	FOREIGN KEY (`instructor_id`) REFERENCES `instructors`(`id`) ON UPDATE cascade ON DELETE set null,
	CONSTRAINT "subject_offerings_status_valid" CHECK("subject_offerings"."status" in ('planned', 'active', 'completed', 'cancelled'))
);
--> statement-breakpoint
CREATE INDEX `subject_offerings_subject_idx` ON `subject_offerings` (`subject_id`);--> statement-breakpoint
CREATE INDEX `subject_offerings_program_period_idx` ON `subject_offerings` (`program_id`,`academic_period_id`);--> statement-breakpoint
CREATE INDEX `subject_offerings_instructor_idx` ON `subject_offerings` (`instructor_id`);--> statement-breakpoint
CREATE TABLE `timeline_events` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`offering_id` integer NOT NULL,
	`location_id` integer,
	`type` text NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`starts_at` integer NOT NULL,
	`ends_at` integer,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`offering_id`) REFERENCES `subject_offerings`(`id`) ON UPDATE cascade ON DELETE restrict,
	FOREIGN KEY (`location_id`) REFERENCES `locations`(`id`) ON UPDATE cascade ON DELETE set null,
	CONSTRAINT "timeline_events_title_nonempty" CHECK(length(trim("timeline_events"."title")) > 0),
	CONSTRAINT "timeline_events_type_valid" CHECK("timeline_events"."type" in ('class', 'academic_event', 'material', 'other')),
	CONSTRAINT "timeline_events_time_order" CHECK("timeline_events"."ends_at" is null or "timeline_events"."ends_at" >= "timeline_events"."starts_at")
);
--> statement-breakpoint
CREATE INDEX `timeline_events_offering_time_idx` ON `timeline_events` (`offering_id`,`starts_at`);--> statement-breakpoint
CREATE INDEX `timeline_events_time_idx` ON `timeline_events` (`starts_at`);--> statement-breakpoint
CREATE INDEX `timeline_events_location_idx` ON `timeline_events` (`location_id`);--> statement-breakpoint
CREATE INDEX `subjects_active_name_idx` ON `subjects` (`active`,`name`);--> statement-breakpoint
CREATE INDEX `subjects_code_idx` ON `subjects` (`code`);