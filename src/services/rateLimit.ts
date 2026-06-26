import type { Context } from "hono";

export function getRateLimitIdentity(c: Context): string {
  return (
    c.req.header("fly-client-ip") ??
    c.req.header("x-real-ip") ??
    c.req.header("x-forwarded-for")?.split(",")[0]?.trim() ??
    "local"
  );
}
