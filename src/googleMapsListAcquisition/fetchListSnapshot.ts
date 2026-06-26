import { HTTPError, type Response } from "got";
import {
  GoogleMapsListParseError,
  GoogleMapsUpstreamError,
} from "./errors.js";
import {
  googleMapsHttpClient,
  mapGotError,
  responseBody,
} from "./googleMapsHttpClient.js";
import type { ListSnapshot } from "./listSnapshot.js";

const GOOGLE_RESPONSE_PREFIX = /^\)\]\}'\n/;
const GOOGLE_MAPS_LIST_URL = "https://www.google.com/maps/preview/entitylist/getlist";
const GOOGLE_MAPS_REQUEST_LOCALE = {
  hl: "zh-TW",
  gl: "tw",
  acceptLanguage: "zh-TW,zh;q=0.9,en;q=0.8",
};

function toUnsignedBigInt(value: unknown) {
  return BigInt.asUintN(64, BigInt(String(value)));
}

function markerPairToGoogleMapsUrl(pair: unknown) {
  if (!Array.isArray(pair) || pair.length < 2 || pair[1] == null) return null;

  try {
    return `https://www.google.com/maps?cid=${toUnsignedBigInt(pair[1]).toString(10)}`;
  } catch {
    return null;
  }
}

function parseGoogleMapsListResponse(text: string, expectedListId: string): ListSnapshot {
  let data: unknown;
  try {
    data = JSON.parse(text.replace(GOOGLE_RESPONSE_PREFIX, ""));
  } catch (error) {
    throw new GoogleMapsListParseError(
      error instanceof Error ? error.message : "Failed to parse Google Maps response",
      { rawResponseText: text },
    );
  }

  const root = Array.isArray(data) ? data[0] : undefined;
  const listId = Array.isArray(root) && Array.isArray(root[0]) ? root[0][0] : undefined;
  const items = Array.isArray(root) ? root[8] : undefined;

  if (listId !== expectedListId) {
    throw new GoogleMapsListParseError(`Unexpected Google Maps List ID: ${String(listId)}`, {
      rawResponseText: text,
    });
  }

  if (!Array.isArray(items)) {
    throw new GoogleMapsListParseError(
      "Google Maps list response did not contain a place array",
      { rawResponseText: text },
    );
  }

  return {
    listId: expectedListId,
    places: items.map((item) => {
      const place = Array.isArray(item) ? item[1] : undefined;
      const markerPair = Array.isArray(place) ? place[6] : undefined;

      return {
        name: (Array.isArray(item) ? item[2] : "") ?? "",
        address: (Array.isArray(place) ? place[4] : "") ?? "",
        note: (Array.isArray(item) ? item[3] : "") ?? "",
        googleMapsUrl: markerPairToGoogleMapsUrl(markerPair),
      };
    }),
  };
}

export async function fetchListSnapshot(
  listId: string,
): Promise<{ readonly snapshot: ListSnapshot; readonly rawResponseText: string }> {
  let response: Response<string>;
  try {
    response = await googleMapsHttpClient(GOOGLE_MAPS_LIST_URL, {
      searchParams: {
        authuser: "0",
        hl: GOOGLE_MAPS_REQUEST_LOCALE.hl,
        gl: GOOGLE_MAPS_REQUEST_LOCALE.gl,
        pb: `!1m4!1s${listId}!2e2!3m1!1e1!2e2!3e2!4i500`,
      },
      headers: {
        accept: "*/*",
        "accept-language": GOOGLE_MAPS_REQUEST_LOCALE.acceptLanguage,
      },
    });
  } catch (error) {
    if (error instanceof HTTPError && [403, 404].includes(error.response.statusCode)) {
      throw new GoogleMapsUpstreamError(
        "Google Maps list is unavailable or private",
        "unavailable_or_private",
        {
          status: error.response.statusCode,
          rawResponseText: responseBody(error.response),
        },
      );
    }

    throw mapGotError(error, (statusCode) => `HTTP ${statusCode} from Google Maps API`);
  }

  return {
    snapshot: parseGoogleMapsListResponse(response.body, listId),
    rawResponseText: response.body,
  };
}
