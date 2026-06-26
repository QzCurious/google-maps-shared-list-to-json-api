import { integer, primaryKey, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const googleMapsSharedListLinkResolutions = sqliteTable("google_maps_shared_list_link_resolutions", {
  link: text("link").primaryKey(),
  listId: text("list_id").notNull(),
  resolvedUrl: text("resolved_url").notNull(),
  expiresAt: integer("expires_at").notNull(),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
});

export const googleMapsListSnapshots = sqliteTable("google_maps_list_snapshots", {
  listId: text("list_id").primaryKey(),
  snapshotJson: text("snapshot_json").notNull(),
  rawResponseText: text("raw_response_text").notNull(),
  etag: text("etag").notNull(),
  expiresAt: integer("expires_at").notNull(),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
});

export const googleMapsFetchFailureCooldowns = sqliteTable("google_maps_fetch_failure_cooldowns", {
  operation: text("operation", { enum: ["link-resolution", "list-snapshot"] }).notNull(),
  key: text("key").notNull(),
  reason: text("reason", {
    enum: [
      "timeout",
      "rate_limited",
      "unavailable_or_private",
      "upstream_5xx",
      "unexpected_status",
      "network_error",
    ],
  }).notNull(),
  errorMessage: text("error_message").notNull(),
  rawResponseText: text("raw_response_text"),
  status: integer("status"),
  expiresAt: integer("expires_at").notNull(),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
}, (table) => [
  primaryKey({ columns: [table.operation, table.key] }),
]);
