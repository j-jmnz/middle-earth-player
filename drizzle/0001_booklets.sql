CREATE TABLE `booklets` (
	`id` text PRIMARY KEY NOT NULL,
	`path` text NOT NULL,
	`original_filename` text NOT NULL,
	`byte_size` integer NOT NULL,
	`sha256` text NOT NULL,
	`page_count` integer NOT NULL,
	`last_page` integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
ALTER TABLE `saves` ADD `loadout` text;
