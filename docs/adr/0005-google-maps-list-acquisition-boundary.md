# Google Maps List Acquisition boundary

Google Maps List Acquisition will be implemented as a framework-neutral module named `googleMapsListAcquisition`. It owns the workflow from Google Maps Shared List Link to List Snapshot, including link resolution, upstream retrieval, parsing, cache semantics, Snapshot Freshness, and acquisition-specific errors, while Hono remains a delivery adapter that performs HTTP validation, headers, status mapping, and OpenAPI documentation. The application owns the database connection lifecycle and passes its `DbClient` to acquisition, but acquisition owns its persistence adapter wiring. External modules should not construct or import the SQLite store adapter; they should depend only on the acquisition factory and the retrieval/invalidation interface. The production implementation should use dedicated acquisition records for link resolutions, list snapshots, and fetch failure cooldowns instead of a generic cache-entry blob table. This keeps acquisition cache-aware while hiding persistence details behind the acquisition boundary.

The public acquisition interface should expose `getListSnapshot(sharedListLink)` and `invalidateSharedListLink(sharedListLink)`. These names keep callers oriented around Google Maps Shared List Links and avoid implying that each request performs an upstream fetch.

Cache TTLs are acquisition policy defaults, not delivery configuration or store decisions: link resolutions and list snapshots are fresh for one hour, and list failures are fresh for five minutes. Factory options may override these values for tests, but the application should not expose them as operational knobs until there is a real need.

Google Maps upstream locale parameters are fixed acquisition policy rather than application configuration. If locale ever becomes caller-controlled or operationally configurable, it must be designed as a List Snapshot variant and included in cache identity.

Raw Google response text may be stored for diagnostics and parser investigation, but `getListSnapshot` does not expose it. Public delivery errors also do not expose raw upstream text.

Admin invalidation is an acquisition operation exposed as `invalidateSharedListLink(sharedListLink)`. Admin routes must call acquisition instead of manipulating the store directly, so the rule for deleting link resolutions and downstream list snapshots stays with acquisition cache policy.

The list-failure-specific cache policy in this decision was superseded by [0006 Google Maps Fetch Failure Cooldown](./0006-google-maps-fetch-failure-cooldown.md).
