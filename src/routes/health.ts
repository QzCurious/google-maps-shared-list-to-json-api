import { Hono } from "hono";

export function createHealthRoutes() {
  return new Hono().get("/healthz", (c) => c.json({ ok: true }));
}
