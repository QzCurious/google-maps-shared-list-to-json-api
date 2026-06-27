export type AppConfig = {
  readonly nodeEnv: string;
  readonly port: number;
  readonly databasePath: string;
  readonly adminToken: string;
  readonly rateLimitWindowSeconds: number;
  readonly rateLimitMaxRequests: number;
};

const readInt = (name: string, fallback: number): number => {
  const raw = process.env[name];
  if (!raw) return fallback;

  const value = Number.parseInt(raw, 10);
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`${name} must be a positive integer`);
  }

  return value;
};

export const loadConfig = (): AppConfig => ({
  nodeEnv: process.env.NODE_ENV ?? "development",
  port: readInt("PORT", 3000),
  databasePath: process.env.DATABASE_PATH ?? "./data/app.sqlite",
  adminToken: process.env.ADMIN_TOKEN ?? "change-me",
  rateLimitWindowSeconds: readInt("RATE_LIMIT_WINDOW_SECONDS", 60),
  rateLimitMaxRequests: readInt("RATE_LIMIT_MAX_REQUESTS", 60),
});
