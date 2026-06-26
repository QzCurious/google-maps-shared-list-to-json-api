# Admin token cookie session

Admin cache controls will use a simple `ADMIN_TOKEN` login page that sets an HttpOnly, HMAC-signed cookie for subsequent admin pages and invalidation routes. The convenient `/admin` route redirects to the login page when no valid cookie is present and to the cache tools when the operator is already logged in. This keeps the operator workflow browser-friendly while avoiding user accounts, external auth providers, or a database-backed admin session model.
