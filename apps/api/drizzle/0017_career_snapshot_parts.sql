CREATE TABLE `career_snapshot_parts` (
	`user_id` text NOT NULL,
	`part` integer NOT NULL,
	`data` text NOT NULL,
	PRIMARY KEY(`user_id`, `part`),
	FOREIGN KEY (`user_id`) REFERENCES `careers`(`user_id`) ON UPDATE no action ON DELETE cascade
);
