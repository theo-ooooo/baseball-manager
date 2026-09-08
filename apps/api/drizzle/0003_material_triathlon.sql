ALTER TABLE `career_staff` ADD `is_real` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `career_staff` ADD `source_club` text;--> statement-breakpoint
ALTER TABLE `career_staff` ADD `source` text;--> statement-breakpoint
ALTER TABLE `career_staff` ADD `verified_role` text;--> statement-breakpoint
ALTER TABLE `coach_candidates` ADD `is_real` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `coach_candidates` ADD `source_club` text;--> statement-breakpoint
ALTER TABLE `coach_candidates` ADD `source` text;--> statement-breakpoint
ALTER TABLE `coach_candidates` ADD `verified_role` text;--> statement-breakpoint
ALTER TABLE `players` ADD `age_estimated` integer DEFAULT false NOT NULL;