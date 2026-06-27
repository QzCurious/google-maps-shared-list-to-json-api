import { Hono } from "hono";
import { raw } from "hono/html";
import type { Child } from "hono/jsx";
import { jsxRenderer } from "hono/jsx-renderer";
import { listSnapshotSchedulePromptTemplate, sharedListLinkPlaceholder } from "../schedulePrompt.js";

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
            input, textarea { box-sizing: border-box; font: inherit; padding: 0.5rem; width: min(100%, 42rem); }
            textarea { min-height: 24rem; }
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
              <a href="/list-snapshots">Get JSON</a>
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
  const promptScript = `
    const form = document.querySelector('[data-list-snapshot-form]');
    const input = document.querySelector('[data-shared-list-link]');
    const output = document.querySelector('[data-schedule-prompt]');
    const promptTemplate = ${JSON.stringify(listSnapshotSchedulePromptTemplate)};
    const placeholder = ${JSON.stringify(sharedListLinkPlaceholder)};

    form?.addEventListener('click', (event) => {
      if (!(event.target instanceof HTMLButtonElement) || event.target.dataset.action !== 'render-schedule-prompt') {
        return;
      }

      if (!(input instanceof HTMLInputElement) || !(output instanceof HTMLTextAreaElement)) {
        return;
      }

      event.preventDefault();

      if (!input.reportValidity()) {
        return;
      }

      output.value = promptTemplate.replaceAll(placeholder, encodeURIComponent(input.value.trim()));
      output.hidden = false;
      output.focus();
      output.select();
    });
  `;

  return (
    <PublicDocument title="Get JSON">
      <>
        <h1>Get JSON</h1>
        <form method="get" action="/v1/list-snapshots" data-list-snapshot-form>
          <label>
            Google Maps Shared List Link
            <input
              name="sharedListLink"
              type="url"
              required
              autofocus
              data-shared-list-link
            />
          </label>
          <div class="actions">
            <button type="submit">Get JSON</button>
            <button type="button" data-action="render-schedule-prompt">Render Schedule Prompt</button>
            <a href="/">Home</a>
          </div>
        </form>
        <label>
          Schedule Prompt
          <textarea readonly hidden data-schedule-prompt />
        </label>
        <script>{raw(promptScript)}</script>
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
