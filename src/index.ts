import { serve } from "@hono/node-server";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { loadConfig } from "./config.js";
import { createApp } from "./app.js";
import { createDbClient } from "./db/client.js";

const config = loadConfig();
const database = createDbClient(config.databasePath);

migrate(database.db, { migrationsFolder: "./drizzle" });

const app = createApp({ config, database });

serve(
  {
    fetch: app.fetch,
    port: config.port,
  },
  (info) => {
    console.log(`Listening on http://localhost:${info.port}`);
  },
);
