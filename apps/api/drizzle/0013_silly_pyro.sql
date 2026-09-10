CREATE TABLE `career_player_records` (
	`user_id` text NOT NULL,
	`id` text NOT NULL,
	`player_id` text NOT NULL,
	`name` text NOT NULL,
	`season` integer NOT NULL,
	`club_id` text NOT NULL,
	`kind` text NOT NULL,
	`data` text NOT NULL,
	PRIMARY KEY(`user_id`, `id`),
	FOREIGN KEY (`user_id`) REFERENCES `careers`(`user_id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_player_records_user_player` ON `career_player_records` (`user_id`,`player_id`,`season`);--> statement-breakpoint
CREATE INDEX `idx_player_records_user_kind` ON `career_player_records` (`user_id`,`kind`,`season`);