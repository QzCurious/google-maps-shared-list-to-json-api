export type GoogleMapsUpstreamFailureReason =
  | "timeout"
  | "rate_limited"
  | "unavailable_or_private"
  | "upstream_5xx"
  | "unexpected_status"
  | "network_error";

type GoogleMapsListAcquisitionErrorDetails = {
  readonly status?: number;
  readonly rawResponseText?: string;
};

class GoogleMapsListAcquisitionError extends Error {
  readonly status?: number;
  readonly rawResponseText?: string;

  constructor(
    message: string,
    { status, rawResponseText }: GoogleMapsListAcquisitionErrorDetails = {},
  ) {
    super(message);
    this.name = new.target.name;
    this.status = status;
    this.rawResponseText = rawResponseText;
  }
}

export class UnsupportedGoogleMapsSharedListLink extends GoogleMapsListAcquisitionError {}

export class GoogleMapsListIdNotFound extends GoogleMapsListAcquisitionError {}

export class GoogleMapsUpstreamError extends GoogleMapsListAcquisitionError {
  readonly reason: GoogleMapsUpstreamFailureReason;

  constructor(
    message: string,
    reason: GoogleMapsUpstreamFailureReason,
    details: GoogleMapsListAcquisitionErrorDetails = {},
  ) {
    super(message, details);
    this.reason = reason;
  }
}

export class GoogleMapsListParseError extends GoogleMapsListAcquisitionError {}
