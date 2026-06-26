import type { Response } from "got";
import {
  GoogleMapsListIdNotFound,
  UnsupportedGoogleMapsSharedListLink,
} from "./errors.js";
import { googleMapsHttpClient, mapGotError } from "./googleMapsHttpClient.js";

function parseUrl(value: string) {
  try {
    return new URL(value);
  } catch {
    throw new UnsupportedGoogleMapsSharedListLink(
      "Google Maps Shared List Link must be a valid URL",
    );
  }
}

function extractListId(url: string) {
  return (
    decodeURIComponent(url.match(/!11m2!2s([^!]+)!3e1/)?.[1] ?? "") ||
    decodeURIComponent(url.match(/\/maps\/placelists\/list\/([^/?#]+)/)?.[1] ?? "")
  );
}

function assertSupportedExpandedGoogleMapsLink(url: URL) {
  const host = url.hostname.toLowerCase();
  if ((host === "google.com" || host === "www.google.com") && url.pathname.startsWith("/maps")) {
    return;
  }

  throw new UnsupportedGoogleMapsSharedListLink(
    "Only Google Maps shared list links are supported",
  );
}

export async function resolveSharedListLink(
  sharedListLink: string,
): Promise<{ readonly listId: string; readonly resolvedUrl: string }> {
  const parsed = parseUrl(sharedListLink);
  const host = parsed.hostname.toLowerCase();

  if (host === "maps.app.goo.gl") {
    let redirect: Response<string>;
    try {
      redirect = await googleMapsHttpClient(sharedListLink, {
        followRedirect: false,
      });
    } catch (error) {
      throw mapGotError(
        error,
        (statusCode) => `HTTP ${statusCode} while resolving Google Maps shared link`,
      );
    }

    const location = redirect.headers.location;
    const resolvedUrl = location ? new URL(location, sharedListLink).toString() : redirect.url;
    const listId = extractListId(resolvedUrl);

    if (!listId) {
      throw new GoogleMapsListIdNotFound(
        "Could not extract Google Maps List ID from resolved shared link",
      );
    }

    return { listId, resolvedUrl };
  }

  assertSupportedExpandedGoogleMapsLink(parsed);

  const listId = extractListId(sharedListLink);
  if (!listId) {
    throw new GoogleMapsListIdNotFound(
      "Could not extract Google Maps List ID from shared link",
    );
  }

  return { listId, resolvedUrl: sharedListLink };
}
