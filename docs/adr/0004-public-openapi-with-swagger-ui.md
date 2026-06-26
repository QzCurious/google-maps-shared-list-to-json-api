# Public OpenAPI with Scalar UI

The API will expose OpenAPI documentation only for `GET /v1/list-snapshots`, with Scalar integrated through Hono as a convenient viewer. Admin routes remain intentionally undocumented in the public OpenAPI contract because they are operator-only HTML/form routes protected by the admin cookie.
