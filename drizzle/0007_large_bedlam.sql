CREATE TABLE `fixtures` (
	`id` text PRIMARY KEY NOT NULL,
	`date` text NOT NULL,
	`league` text NOT NULL,
	`home` text NOT NULL,
	`away` text NOT NULL,
	`time` text,
	`source` text,
	FOREIGN KEY (`home`) REFERENCES `clubs`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`away`) REFERENCES `clubs`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_fixtures_date_league` ON `fixtures` (`date`,`league`);