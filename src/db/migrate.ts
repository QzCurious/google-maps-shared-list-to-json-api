import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { loadConfig } from "../config.js";
import { createDbClient } from "./client.js";

const config = loadConfig();
const database = createDbClient(config.databasePath);

migrate(database.db, { migrationsFolder: "./drizzle" });
database.close();
