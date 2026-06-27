import { createHmac, timingSafeEqual } from "node:crypto";
import { Hono } from "hono";
import type { MiddlewareHandler } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import type { Child } from "hono/jsx";
import { jsxRenderer } from "hono/jsx-renderer";
import type { AppConfig } from "../config.js";
import type {
  GoogleMapsListAcquisition,
  SharedListLinkInvalidation,
} from "../googleMapsListAcquisition/exports.js";

type AdminRouteDependencies = {
  readonly config: AppConfig;
  readonly googleMapsListAcquisition: GoogleMapsListAcquisition;
};

const ADMIN_COOKIE_NAME = "admin_session";

function AdminDocument({ title, children }: { readonly title: string; readonly children: Child }) {
  return (
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>{title}</title>
        <style>
          {`
            body { font-family: system-ui, sans-serif; margin: 2rem; max-width: 48rem; }
            main { display: grid; gap: 1rem; }
            label { display: grid; gap: 0.4rem; }
            input { font: inherit; padding: 0.5rem; width: min(100%, 42rem); }
            button { font: inherit; padding: 0.45rem 0.7rem; }
            .actions { display: flex; gap: 0.5rem; align-items: center; }
            .error { color: #9f1239; }
            .result { background: #f6f8fa; padding: 1rem; border-radius: 6px; }
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

function createAdminCookieValue(config: AppConfig) {
  return `v1.${createHmac("sha256", config.adminToken).update("admin").digest("base64url")}`;
}

function hasValidAdminCookie(config: AppConfig, cookieValue: string | undefined) {
  if (!cookieValue) return false;

  const expected = createAdminCookieValue(config);
  const actualBuffer = Buffer.from(cookieValue);
  const expectedBuffer = Buffer.from(expected);

  return actualBuffer.length === expectedBuffer.length && timingSafeEqual(actualBuffer, expectedBuffer);
}

function LoginPage({ message = "" }: { readonly message?: string }) {
  return (
    <AdminDocument title="Admin Login">
      <>
        <h1>Admin Login</h1>
        {message ? <p class="error">{message}</p> : null}
        <form method="post" action="/admin/login">
          <label>
            Admin token
            <input name="adminToken" type="password" autocomplete="current-password" autofocus />
          </label>
          <div class="actions">
            <button type="submit">Login</button>
          </div>
        </form>
      </>
    </AdminDocument>
  );
}

function CachePage({ result }: { readonly result?: SharedListLinkInvalidation & { readonly link: string } }) {
  return (
    <AdminDocument title="Admin Cache">
      <>
        <h1>Cache Tools</h1>
        <form method="post" action="/admin/cache/link-resolution/invalidate">
          <label>
            Google Maps Shared List Link
            <input name="sharedListLink" type="url" required />
          </label>
          <div class="actions">
            <button type="submit">Invalidate</button>
          </div>
        </form>
        {result ? (
          <section class="result">
            <h2>Invalidation Result</h2>
            <p>
              <strong>Link:</strong> <code>{result.link}</code>
            </p>
            <p>
              <strong>List ID:</strong> <code>{result.listId ?? "not found"}</code>
            </p>
            <p>
              <strong>Link resolution deleted:</strong> {result.linkResolutionDeleted ? "yes" : "no"}
            </p>
            <p>
              <strong>Link resolution failure cooldown deleted:</strong>{" "}
              {result.linkResolutionFailureCooldownDeleted ? "yes" : "no"}
            </p>
            <p>
              <strong>List snapshot deleted:</strong> {result.listSnapshotDeleted ? "yes" : "no"}
            </p>
            <p>
              <strong>List snapshot failure cooldown deleted:</strong>{" "}
              {result.listSnapshotFailureCooldownDeleted ? "yes" : "no"}
            </p>
          </section>
        ) : null}
        <form method="post" action="/admin/logout">
          <button type="submit">Logout</button>
        </form>
      </>
    </AdminDocument>
  );
}

export function createAdminRoutes({ config, googleMapsListAcquisition }: AdminRouteDependencies) {
  function isLoggedIn(cookieValue: string | undefined) {
    return hasValidAdminCookie(config, cookieValue);
  }

  const requireAdminCookie: MiddlewareHandler = async (c, next) => {
    if (!isLoggedIn(getCookie(c, ADMIN_COOKIE_NAME))) {
      return c.redirect("/admin/login");
    }

    await next();
  };

  return new Hono()
    .use(jsxRenderer())
    .get("/admin", (c) =>
      isLoggedIn(getCookie(c, ADMIN_COOKIE_NAME))
        ? c.redirect("/admin/cache")
        : c.redirect("/admin/login"),
    )
    .get("/admin/login", (c) =>
      isLoggedIn(getCookie(c, ADMIN_COOKIE_NAME))
        ? c.redirect("/admin/cache")
        : c.render(<LoginPage />),
    )
    .post("/admin/login", async (c) => {
      const body = await c.req.parseBody();
      const adminToken = typeof body.adminToken === "string" ? body.adminToken : "";

      if (adminToken !== config.adminToken) {
        c.status(401);
        return c.render(<LoginPage message="Invalid admin token" />);
      }

      setCookie(c, ADMIN_COOKIE_NAME, createAdminCookieValue(config), {
        httpOnly: true,
        sameSite: "Lax",
        secure: config.nodeEnv === "production",
        path: "/admin",
      });

      return c.redirect("/admin/cache");
    })
    .post("/admin/logout", (c) => {
      deleteCookie(c, ADMIN_COOKIE_NAME, {
        path: "/admin",
      });
      return c.redirect("/admin/login");
    })
    .use("/admin/cache", requireAdminCookie)
    .use("/admin/cache/*", requireAdminCookie)
    .get("/admin/cache", (c) => c.render(<CachePage />))
    .post("/admin/cache/link-resolution/invalidate", async (c) => {
      const body = await c.req.parseBody();
      const sharedListLink = typeof body.sharedListLink === "string" ? body.sharedListLink.trim() : "";

      if (!sharedListLink) {
        c.status(400);
        return c.render(<CachePage />);
      }

      const result = await googleMapsListAcquisition.invalidateSharedListLink(sharedListLink);
      return c.render(<CachePage result={{ ...result, link: sharedListLink }} />);
    });
}
