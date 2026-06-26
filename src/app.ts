import { Scalar } from "@scalar/hono-api-reference";
import { OpenAPIHono } from "@hono/zod-openapi";
import type { AppConfig } from "./config.js";
import type { DbClient } from "./db/client.js";
import { createGoogleMapsListAcquisition } from "./googleMapsListAcquisition/exports.js";
import { createAdminRoutes } from "./routes/admin.js";
import { createHealthRoutes } from "./routes/health.js";
import { createPublicRoutes } from "./routes/public.js";
import { createSnapshotRoutes } from "./routes/snapshots.js";

export type AppDependencies = {
  readonly config: AppConfig;
  readonly database: DbClient;
};

export function createApp({ config, database }: AppDependencies) {
  const googleMapsListAcquisition = createGoogleMapsListAcquisition({
    database,
  });

  return new OpenAPIHono()
    .route("/", createPublicRoutes())
    .route("/", createHealthRoutes())
    .route("/", createSnapshotRoutes({ config, googleMapsListAcquisition }))
    .route("/", createAdminRoutes({ config, googleMapsListAcquisition }))
    .doc31("/openapi.json", {
      openapi: "3.1.0",
      info: {
        title: "Google Maps Shared List JSON API",
        version: "0.1.0",
      },
    })
    .get("/docs", Scalar({ url: "/openapi.json" }));
}
