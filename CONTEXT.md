# Google Maps Shared List JSON API

This context describes a public API that turns a public Google Maps shared list into a normalized JSON representation.

## Language

**Google Maps Shared List Link**:
A user-facing Google Maps URL that points, directly or through redirect, to a public Google Maps list.
_Avoid_: Shared List Link, input URL, short link

**Google Maps List ID**:
The stable Google Maps identifier extracted from a Google Maps Shared List Link and used to request the list data.
_Avoid_: List ID, place list token, share id

**Place Entry**:
A single saved place contained in a Google Maps list, including its display name, address, optional note, and canonical Google Maps URL when available.
_Avoid_: item, marker, row

**List Snapshot**:
The normalized JSON representation of all Place Entries returned for a Google Maps Shared List Link at a point in time. A List Snapshot is cached by Google Maps List ID for one hour, independent of locale parameters.
_Avoid_: result, payload, export

**Google Maps List Acquisition**:
The application capability, implemented as `googleMapsListAcquisition`, that turns a Google Maps Shared List Link into a List Snapshot, including link resolution, upstream retrieval, parsing, and cache-aware failure handling.
_Avoid_: service, fetcher, route logic

**Snapshot Freshness**:
Cache-derived facts about a List Snapshot that delivery layers may use for their own protocols, such as an entity tag or freshness duration.
_Avoid_: HTTP headers, response metadata, cache-control

**Link Resolution**:
The mapping from a Google Maps Shared List Link to its Google Maps List ID.
_Avoid_: redirect cache, URL cache, short-link cache

**Rate Limit Identity**:
The client identity used to group public API requests for throttling, derived from Fly.io trusted proxy headers in production and local request metadata during development.
_Avoid_: IP, user, requester

**Rate Limit Window**:
A fixed sixty-second interval during which a Rate Limit Identity may make up to sixty public API requests.
_Avoid_: quota period, throttle bucket

**Link Resolution Invalidation**:
An operator action that removes locally stored acquisition data for a specific Google Maps Shared List Link. When a cached Google Maps List ID is known, the corresponding List Snapshot and Google Maps Fetch Failure Cooldown are removed too.
_Avoid_: cache clear, purge, refresh

**Google Maps Fetch Failure Cooldown**:
A short-lived record of a failed Google Maps upstream attempt that prevents repeated requests for the same Google Maps Shared List Link or Google Maps List ID while preserving the reason the attempt failed. Local input validation and List Snapshot parsing failures are not Google Maps Fetch Failure Cooldowns.
_Avoid_: error cache, negative cache, throttle
