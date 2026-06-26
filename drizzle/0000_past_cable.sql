CREATE TABLE `google_maps_list_failures` (
	`list_id` text PRIMARY KEY NOT NULL,
	`error_code` text NOT NULL,
	`error_message` text NOT NULL,
	`raw_response_text` text,
	`status` integer NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `google_maps_list_snapshots` (
	`list_id` text PRIMARY KEY NOT NULL,
	`snapshot_json` text NOT NULL,
	`raw_response_text` text NOT NULL,
	`etag` text NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `google_maps_shared_list_link_resolutions` (
	`link` text PRIMARY KEY NOT NULL,
	`list_id` text NOT NULL,
	`resolved_url` text NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
