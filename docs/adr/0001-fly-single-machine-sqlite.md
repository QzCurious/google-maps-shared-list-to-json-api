# Fly single-machine SQLite deployment

We will run the API as a Node.js 24 LTS service on one Fly.io auto-suspend machine, using SQLite on an attached volume through DrizzleORM for both List Snapshot caching and IP-based rate limiting. This intentionally avoids Redis or a separate database service, and prefers Fly.io over Vercel Fluid Compute because the design needs durable local storage that remains coherent for a single public API process.

**Considered Options**

- Vercel Fluid Compute with local SQLite: rejected because local filesystem persistence and single-process coherence are not the right assumptions for cache and rate-limit state.
- Fly.io single machine with SQLite: accepted because it satisfies the one-process, no-extra-service constraint while still allowing auto-suspend.
- External Redis or hosted database: rejected for now because the expected workload is small and the project explicitly favors operational lightness.
