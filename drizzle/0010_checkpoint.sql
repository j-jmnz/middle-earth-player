ALTER TABLE `saves` ADD `checkpoint` text;--> statement-breakpoint
ALTER TABLE `saves` ADD `rebase` text;--> statement-breakpoint
ALTER TABLE `standalone_games` ADD `checkpoint` text;--> statement-breakpoint
ALTER TABLE `standalone_games` ADD `rebase` text;--> statement-breakpoint
ALTER TABLE `runs` ADD `rebased` integer DEFAULT 0 NOT NULL;
