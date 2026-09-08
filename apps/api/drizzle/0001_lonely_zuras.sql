CREATE TABLE `agents` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`agency` text NOT NULL,
	`fee` real NOT NULL,
	`priority` text NOT NULL,
	`sort_order` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `career_actions` (
	`user_id` text NOT NULL,
	`revision` integer NOT NULL,
	`kind` text NOT NULL,
	`request_id` text NOT NULL,
	`created_at` text NOT NULL,
	PRIMARY KEY(`user_id`, `revision`),
	FOREIGN KEY (`user_id`) REFERENCES `careers`(`user_id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_actions_user_request` ON `career_actions` (`user_id`,`request_id`);--> statement-breakpoint
CREATE TABLE `career_matches` (
	`user_id` text NOT NULL,
	`match_id` text NOT NULL,
	`season` integer NOT NULL,
	`day` integer NOT NULL,
	`home` text NOT NULL,
	`away` text NOT NULL,
	`home_score` integer NOT NULL,
	`away_score` integer NOT NULL,
	`data` text NOT NULL,
	PRIMARY KEY(`user_id`, `match_id`),
	FOREIGN KEY (`user_id`) REFERENCES `careers`(`user_id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `career_players` (
	`user_id` text NOT NULL,
	`player_id` text NOT NULL,
	`club_id` text NOT NULL,
	`position` text NOT NULL,
	`name` text NOT NULL,
	`data` text NOT NULL,
	PRIMARY KEY(`user_id`, `player_id`),
	FOREIGN KEY (`user_id`) REFERENCES `careers`(`user_id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `career_staff` (
	`user_id` text NOT NULL,
	`role` text NOT NULL,
	`coach_id` text NOT NULL,
	`name` text NOT NULL,
	`skill` integer NOT NULL,
	`salary` real NOT NULL,
	`style` text NOT NULL,
	PRIMARY KEY(`user_id`, `role`),
	FOREIGN KEY (`user_id`) REFERENCES `careers`(`user_id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `career_standings` (
	`user_id` text NOT NULL,
	`club_id` text NOT NULL,
	`league_id` text NOT NULL,
	`season` integer NOT NULL,
	`wins` integer NOT NULL,
	`losses` integer NOT NULL,
	`draws` integer NOT NULL,
	`runs_for` integer NOT NULL,
	`runs_against` integer NOT NULL,
	PRIMARY KEY(`user_id`, `club_id`),
	FOREIGN KEY (`user_id`) REFERENCES `careers`(`user_id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`club_id`) REFERENCES `clubs`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `catalog_meta` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `clubs` (
	`id` text PRIMARY KEY NOT NULL,
	`league_id` text NOT NULL,
	`name` text NOT NULL,
	`short` text NOT NULL,
	`color` text NOT NULL,
	`city` text NOT NULL,
	`division` text NOT NULL,
	`sort_order` integer NOT NULL,
	FOREIGN KEY (`league_id`) REFERENCES `leagues`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_clubs_league` ON `clubs` (`league_id`);--> statement-breakpoint
CREATE TABLE `coach_candidates` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`role` text NOT NULL,
	`skill` integer NOT NULL,
	`salary` real NOT NULL,
	`style` text NOT NULL,
	`sort_order` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `contracts` (
	`user_id` text NOT NULL,
	`player_id` text NOT NULL,
	`club_id` text NOT NULL,
	`salary` real NOT NULL,
	`years` integer NOT NULL,
	`season` integer NOT NULL,
	`agent_id` text NOT NULL,
	PRIMARY KEY(`user_id`, `player_id`),
	FOREIGN KEY (`user_id`) REFERENCES `careers`(`user_id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`agent_id`) REFERENCES `agents`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `finance_entries` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`revision` integer NOT NULL,
	`season` integer NOT NULL,
	`day` integer NOT NULL,
	`kind` text NOT NULL,
	`amount` real NOT NULL,
	`balance` real NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `careers`(`user_id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_finance_user_revision` ON `finance_entries` (`user_id`,`revision`);--> statement-breakpoint
CREATE TABLE `leagues` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`country` text NOT NULL,
	`flag` text NOT NULL,
	`region` text NOT NULL,
	`label` text NOT NULL,
	`games` integer NOT NULL,
	`level` integer NOT NULL,
	`source` text NOT NULL,
	`season` text NOT NULL,
	`sort_order` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `negotiations` (
	`user_id` text NOT NULL,
	`deal_id` text NOT NULL,
	`player_id` text NOT NULL,
	`status` text NOT NULL,
	`salary` real NOT NULL,
	`years` integer NOT NULL,
	`data` text NOT NULL,
	PRIMARY KEY(`user_id`, `deal_id`),
	FOREIGN KEY (`user_id`) REFERENCES `careers`(`user_id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `players` (
	`id` text PRIMARY KEY NOT NULL,
	`club_id` text,
	`name` text NOT NULL,
	`original` text NOT NULL,
	`position` text NOT NULL,
	`age` integer NOT NULL,
	`is_real` integer NOT NULL,
	`country` text NOT NULL,
	`number` integer NOT NULL,
	`contact` real NOT NULL,
	`power` real NOT NULL,
	`speed` real NOT NULL,
	`fielding` real NOT NULL,
	`stuff` real NOT NULL,
	`control` real NOT NULL,
	`potential` real NOT NULL,
	`salary` real NOT NULL,
	`years` integer NOT NULL,
	`source` text,
	`sort_order` integer NOT NULL,
	FOREIGN KEY (`club_id`) REFERENCES `clubs`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_players_club` ON `players` (`club_id`);--> statement-breakpoint
CREATE INDEX `idx_players_name` ON `players` (`name`);--> statement-breakpoint
CREATE TABLE `transfers` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`player_id` text NOT NULL,
	`player_name` text NOT NULL,
	`from_club` text NOT NULL,
	`to_club` text NOT NULL,
	`kind` text NOT NULL,
	`season` integer NOT NULL,
	`day` integer NOT NULL,
	`revision` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `careers`(`user_id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_transfers_user_revision` ON `transfers` (`user_id`,`revision`);--> statement-breakpoint
ALTER TABLE `careers` ADD `write_token` text DEFAULT '' NOT NULL;