CREATE TABLE `decks` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`heroes` text NOT NULL,
	`cards` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `saves` (
	`id` text PRIMARY KEY NOT NULL,
	`campaign_id` text NOT NULL,
	`seat_count` integer NOT NULL,
	`log` text NOT NULL,
	`pool` text NOT NULL,
	`active_scenario` text
);
--> statement-breakpoint
CREATE TABLE `image_files` (
	`code` text PRIMARY KEY NOT NULL,
	`path` text,
	`width` integer,
	`height` integer,
	`byte_size` integer,
	`media_type` text,
	`sha256` text
);
--> statement-breakpoint
CREATE TABLE `meta` (
	`id` integer PRIMARY KEY NOT NULL,
	`applied_catalog_version` integer,
	CONSTRAINT "meta_id_check" CHECK("meta"."id" = 1)
);
