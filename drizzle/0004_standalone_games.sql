CREATE TABLE `standalone_games` (
	`id` text PRIMARY KEY NOT NULL,
	`campaign_id` text NOT NULL,
	`scenario_id` text NOT NULL,
	`seat_count` integer NOT NULL,
	`loadout` text NOT NULL,
	`active_scenario` text,
	`result` text,
	`created_at` integer NOT NULL,
	`archived_at` integer
);
