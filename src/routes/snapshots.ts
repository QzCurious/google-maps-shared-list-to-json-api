import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { rateLimiter } from "hono-rate-limiter";
import type { AppConfig } from "../config.js";
import { ErrorResponseSchema, type ErrorResponse } from "../dto.js";
import {
  GoogleMapsListIdNotFound,
  GoogleMapsListParseError,
  GoogleMapsUpstreamError,
  ListSnapshotSchema,
  UnsupportedGoogleMapsSharedListLink,
  type GoogleMapsListAcquisition,
} from "../googleMapsListAcquisition/exports.js";
import { getRateLimitIdentity } from "../services/exports.js";

type SnapshotRouteDependencies = {
  readonly config: AppConfig;
  readonly googleMapsListAcquisition: GoogleMapsListAcquisition;
};

export function createSnapshotRoutes({
  config,
  googleMapsListAcquisition,
}: SnapshotRouteDependencies) {
  const listSnapshotsRoute = createRoute({
    method: "get",
    path: "/v1/list-snapshots",
    request: {
      query: z.object({
        sharedListLink: z.string().url(),
      }),
    },
    responses: {
      200: {
        description: "A normalized Google Maps list snapshot.",
        content: {
          "application/json": {
            schema: ListSnapshotSchema,
          },
        },
      },
      304: {
        description: "The client already has the current List Snapshot.",
      },
      400: {
        description: "Invalid or unsupported request.",
        content: {
          "application/json": {
            schema: ErrorResponseSchema,
          },
        },
      },
      404: {
        description: "The Google Maps list could not be retrieved.",
        content: {
          "application/json": {
            schema: ErrorResponseSchema,
          },
        },
      },
      429: {
        description: "Rate limit exceeded.",
        content: {
          "application/json": {
            schema: ErrorResponseSchema,
          },
        },
      },
      502: {
        description: "Google Maps upstream request failed.",
        content: {
          "application/json": {
            schema: ErrorResponseSchema,
          },
        },
      },
    },
  });

  const routes = new OpenAPIHono();
  routes.use(
    listSnapshotsRoute.getRoutingPath(),
    rateLimiter({
      windowMs: config.rateLimitWindowSeconds * 1000,
      limit: config.rateLimitMaxRequests,
      keyGenerator: getRateLimitIdentity,
      standardHeaders: "draft-6",
      statusCode: 429,
      message: {
        error: {
          code: "RATE_LIMITED",
          message: "Too many requests",
        },
      } satisfies ErrorResponse,
    }),
  );

  return routes.openapi(listSnapshotsRoute, async (c) => {
    const { sharedListLink } = c.req.valid("query");
    try {
      const snapshot =
        await googleMapsListAcquisition.getListSnapshot(sharedListLink);
      c.header(
        "Cache-Control",
        `public, max-age=${snapshot.freshness.maxAgeSeconds}`,
      );
      c.header("ETag", snapshot.freshness.etag);
      if (c.req.header("if-none-match") === snapshot.freshness.etag) {
        return c.body(null, 304);
      }

      return c.json(snapshot.snapshot, 200);
    } catch (error) {
      if (error instanceof GoogleMapsListIdNotFound) {
        return c.json(
          {
            error: {
              code: "LIST_ID_NOT_FOUND",
              message: error.message,
            },
          } satisfies ErrorResponse,
          400,
        );
      }

      if (
        error instanceof GoogleMapsUpstreamError &&
        error.reason === "unavailable_or_private"
      ) {
        return c.json(
          {
            error: {
              code: "LIST_ID_NOT_FOUND",
              message: error.message,
            },
          } satisfies ErrorResponse,
          404,
        );
      }

      if (error instanceof GoogleMapsListParseError) {
        return c.json(
          {
            error: {
              code: "GOOGLE_MAPS_RESPONSE_PARSE_ERROR",
              message: error.message,
            },
          } satisfies ErrorResponse,
          502,
        );
      }

      if (error instanceof GoogleMapsUpstreamError) {
        return c.json(
          {
            error: {
              code: "GOOGLE_MAPS_UPSTREAM_ERROR",
              message: error.message,
            },
          } satisfies ErrorResponse,
          502,
        );
      }

      if (error instanceof UnsupportedGoogleMapsSharedListLink) {
        return c.json(
          {
            error: {
              code: "UNSUPPORTED_SHARED_LIST_LINK",
              message: error.message,
            },
          } satisfies ErrorResponse,
          400,
        );
      }

      return c.json(
        {
          error: {
            code: "GOOGLE_MAPS_UPSTREAM_ERROR",
            message:
              error instanceof Error
                ? error.message
                : "Google Maps request failed",
          },
        } satisfies ErrorResponse,
        502,
      );
    }
  });
}
