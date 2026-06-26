DROP TABLE `google_maps_list_failures`;
--> statement-breakpoint
CREATE TABLE `google_maps_fetch_failure_cooldowns` (
	`operation` text NOT NULL,
	`key` text NOT NULL,
	`reason` text NOT NULL,
	`error_message` text NOT NULL,
	`raw_response_text` text,
	`status` integer,
	`expires_at` integer NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	PRIMARY KEY(`operation`, `key`)
);
