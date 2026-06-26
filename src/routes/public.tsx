import { Hono } from "hono";
import type { Child } from "hono/jsx";
import { jsxRenderer } from "hono/jsx-renderer";

function PublicDocument({ title, children }: { readonly title: string; readonly children: Child }) {
  return (
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>{title}</title>
        <style>
          {`
            body { font-family: system-ui, sans-serif; margin: 2rem; max-width: 48rem; }
            main { display: grid; gap: 1.25rem; }
            nav ul { display: grid; gap: 0.6rem; padding-left: 1.2rem; }
            label { display: grid; gap: 0.4rem; }
            input { font: inherit; padding: 0.5rem; width: min(100%, 42rem); }
            button { font: inherit; padding: 0.45rem 0.7rem; }
            .actions { display: flex; gap: 0.5rem; align-items: center; }
            code { overflow-wrap: anywhere; }
          `}
        </style>
      </head>
      <body>
        <main>{children}</main>
      </body>
    </html>
  );
}

function HomePage() {
  return (
    <PublicDocument title="Google Maps Shared List JSON API">
      <>
        <h1>Google Maps Shared List JSON API</h1>
        <nav aria-label="Pages">
          <ul>
            <li>
              <a href="/list-snapshots">List Snapshot form</a>
            </li>
            <li>
              <a href="/docs">API docs</a>
            </li>
            <li>
              <a href="/openapi.json">OpenAPI JSON</a>
            </li>
            <li>
              <a href="/admin">Admin</a>
            </li>
            <li>
              <a href="/healthz">Health</a>
            </li>
          </ul>
        </nav>
      </>
    </PublicDocument>
  );
}

function ListSnapshotsPage() {
  return (
    <PublicDocument title="List Snapshot">
      <>
        <h1>List Snapshot</h1>
        <form method="get" action="/v1/list-snapshots">
          <label>
            Google Maps Shared List Link
            <input
              name="sharedListLink"
              type="url"
              required
              autofocus
              placeholder="https://maps.app.goo.gl/GBM3X5jfHHnoUyK38"
            />
          </label>
          <div class="actions">
            <button type="submit">Get JSON</button>
            <a href="/">Home</a>
          </div>
        </form>
      </>
    </PublicDocument>
  );
}

export function createPublicRoutes() {
  return new Hono()
    .use(jsxRenderer())
    .get("/", (c) => c.render(<HomePage />))
    .get("/list-snapshots", (c) => c.render(<ListSnapshotsPage />));
}
