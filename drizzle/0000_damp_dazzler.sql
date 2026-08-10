CREATE TABLE `actresses` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`slug` text NOT NULL,
	`sort_name` text NOT NULL,
	`initial` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`video_count` integer DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_actresses_slug_unique` ON `actresses` (`slug`);--> statement-breakpoint
CREATE INDEX `idx_actresses_initial_sort` ON `actresses` (`initial`,`sort_name`);--> statement-breakpoint
CREATE TABLE `sync_state` (
	`source` text PRIMARY KEY NOT NULL,
	`listing` text NOT NULL,
	`last_page` integer DEFAULT 0 NOT NULL,
	`last_source_id` integer,
	`status` text DEFAULT 'idle' NOT NULL,
	`error` text,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE `tags` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`slug` text NOT NULL,
	`video_count` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_tags_slug_unique` ON `tags` (`slug`);--> statement-breakpoint
CREATE TABLE `video_actresses` (
	`video_id` integer NOT NULL,
	`actress_id` integer NOT NULL,
	`position` integer DEFAULT 0 NOT NULL,
	PRIMARY KEY(`video_id`, `actress_id`),
	FOREIGN KEY (`video_id`) REFERENCES `videos`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`actress_id`) REFERENCES `actresses`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_video_actresses_actress_video` ON `video_actresses` (`actress_id`,`video_id`);--> statement-breakpoint
CREATE TABLE `video_tags` (
	`video_id` integer NOT NULL,
	`tag_id` integer NOT NULL,
	PRIMARY KEY(`video_id`, `tag_id`),
	FOREIGN KEY (`video_id`) REFERENCES `videos`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`tag_id`) REFERENCES `tags`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_video_tags_tag_video` ON `video_tags` (`tag_id`,`video_id`);--> statement-breakpoint
CREATE TABLE `videos` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`source_id` integer NOT NULL,
	`slug` text NOT NULL,
	`original_title` text NOT NULL,
	`display_title` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`type` text NOT NULL,
	`work_id` integer,
	`year` integer,
	`duration_seconds` integer DEFAULT 0 NOT NULL,
	`rating` integer DEFAULT 0 NOT NULL,
	`popularity_rank` integer,
	`thumbnail_key` text NOT NULL,
	`thumbnail_width` integer DEFAULT 280 NOT NULL,
	`thumbnail_height` integer DEFAULT 210 NOT NULL,
	`embed_id` integer NOT NULL,
	`source_url` text NOT NULL,
	`published_at` text,
	`first_seen_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	FOREIGN KEY (`work_id`) REFERENCES `works`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_videos_source_id_unique` ON `videos` (`source_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_videos_slug_unique` ON `videos` (`slug`);--> statement-breakpoint
CREATE INDEX `idx_videos_latest` ON `videos` (`is_active`,`first_seen_at`,`id`);--> statement-breakpoint
CREATE INDEX `idx_videos_popular` ON `videos` (`is_active`,`popularity_rank`,`id`);--> statement-breakpoint
CREATE INDEX `idx_videos_rating` ON `videos` (`is_active`,`rating`,`id`);--> statement-breakpoint
CREATE INDEX `idx_videos_work` ON `videos` (`work_id`,`is_active`,`id`);--> statement-breakpoint
CREATE INDEX `idx_videos_year` ON `videos` (`year`,`is_active`,`id`);--> statement-breakpoint
CREATE TABLE `works` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`type` text NOT NULL,
	`title` text NOT NULL,
	`slug` text NOT NULL,
	`sort_title` text NOT NULL,
	`initial` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`year` integer,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_works_type_slug_unique` ON `works` (`type`,`slug`);--> statement-breakpoint
CREATE INDEX `idx_works_type_initial_sort` ON `works` (`type`,`initial`,`sort_title`);
--> statement-breakpoint
PRAGMA optimize;
