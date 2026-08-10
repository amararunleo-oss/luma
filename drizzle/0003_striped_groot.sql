CREATE TABLE `content_reports` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`video_id` integer,
	`video_slug` text NOT NULL,
	`category` text NOT NULL,
	`details` text DEFAULT '' NOT NULL,
	`contact_email` text,
	`reporter_hash` text NOT NULL,
	`status` text DEFAULT 'open' NOT NULL,
	`admin_note` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`video_id`) REFERENCES `videos`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `idx_content_reports_status_created` ON `content_reports` (`status`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_content_reports_reporter_created` ON `content_reports` (`reporter_hash`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_content_reports_video` ON `content_reports` (`video_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `monitor_runs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`status` text DEFAULT 'running' NOT NULL,
	`checked_count` integer DEFAULT 0 NOT NULL,
	`broken_count` integer DEFAULT 0 NOT NULL,
	`error` text DEFAULT '' NOT NULL,
	`started_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`completed_at` text
);
--> statement-breakpoint
CREATE INDEX `idx_monitor_runs_started` ON `monitor_runs` (`started_at`);--> statement-breakpoint
CREATE TABLE `video_health_checks` (
	`video_id` integer PRIMARY KEY NOT NULL,
	`embed_status` text DEFAULT 'unknown' NOT NULL,
	`thumbnail_status` text DEFAULT 'unknown' NOT NULL,
	`response_time_ms` integer,
	`failure_count` integer DEFAULT 0 NOT NULL,
	`last_error` text DEFAULT '' NOT NULL,
	`last_checked_at` text,
	`next_check_at` text,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`video_id`) REFERENCES `videos`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_video_health_next_check` ON `video_health_checks` (`next_check_at`,`embed_status`);--> statement-breakpoint
CREATE INDEX `idx_video_health_embed_status` ON `video_health_checks` (`embed_status`,`failure_count`);