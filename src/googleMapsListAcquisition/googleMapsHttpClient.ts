import got, { HTTPError, TimeoutError, type Response } from "got";
import {
  GoogleMapsUpstreamError,
  type GoogleMapsUpstreamFailureReason,
} from "./errors.js";

const REQUEST_TIMEOUT_MS = 5_000;
const RETRY_STATUS_CODES = Array.from({ length: 100 }, (_, index) => 500 + index);
const USER_AGENT =
  "Mozilla/5.0 (compatible; GoogleMapsSharedListJsonApi/0.1; +https://example.invalid)";

export const googleMapsHttpClient = got.extend({
  headers: {
    "user-agent": USER_AGENT,
  },
  responseType: "text",
  retry: {
    limit: 1,
    methods: ["GET"],
    statusCodes: RETRY_STATUS_CODES,
  },
  timeout: {
    request: REQUEST_TIMEOUT_MS,
  },
});

export function responseBody(response: Response<unknown>) {
  return typeof response.body === "string" ? response.body : undefined;
}

function reasonForStatus(statusCode: number): GoogleMapsUpstreamFailureReason {
  if (statusCode === 429) return "rate_limited";
  if (statusCode >= 500) return "upstream_5xx";
  return "unexpected_status";
}

export function mapGotError(
  error: unknown,
  httpMessage: (statusCode: number) => string,
): GoogleMapsUpstreamError {
  if (error instanceof HTTPError) {
    return new GoogleMapsUpstreamError(
      httpMessage(error.response.statusCode),
      reasonForStatus(error.response.statusCode),
      {
        status: error.response.statusCode,
        rawResponseText: responseBody(error.response),
      },
    );
  }

  if (error instanceof TimeoutError) {
    return new GoogleMapsUpstreamError("Google Maps request timed out", "timeout");
  }

  return new GoogleMapsUpstreamError(
    error instanceof Error ? error.message : "Google Maps request failed",
    "network_error",
  );
}
