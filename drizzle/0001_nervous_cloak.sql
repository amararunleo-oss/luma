CREATE TABLE `video_listings` (
	`video_id` integer NOT NULL,
	`listing` text NOT NULL,
	`position` integer,
	`seen_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	PRIMARY KEY(`video_id`, `listing`),
	FOREIGN KEY (`video_id`) REFERENCES `videos`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_video_listings_listing_position` ON `video_listings` (`listing`,`position`,`video_id`);
--> statement-breakpoint
PRAGMA optimize;
