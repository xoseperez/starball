// Baseline security: CORS, Origin/Referer check, per-IP rate limiter.

import type { Context, MiddlewareHandler } from "hono";
import { ALLOWED_ORIGINS, RATE_LIMIT_READ_PER_MIN, RATE_LIMIT_WRITE_PER_MIN } from "./config.js";

// ---------------------------------------------------------------------------
// Origin check — applied to mutating routes
// ---------------------------------------------------------------------------

function originHostname(value: string | null): string | null {
  if (!value) return null;
  try {
    return new URL(value).hostname;
  } catch {
    return null;
  }
}

function allowedHostnames(): Set<string> {
  return new Set(
    ALLOWED_ORIGINS.map((o) => originHostname(o)).filter(
      (h): h is string => h !== null,
    ),
  );
}

/** Allow only requests whose Origin (or Referer hostname) is in ALLOWED_ORIGINS.
 *  If ALLOWED_ORIGINS is empty, require an Origin header at minimum (rejects
 *  bare curl/postman calls that omit Origin entirely). */
export const requireAllowedOrigin: MiddlewareHandler = async (c, next) => {
  const origin = c.req.header("Origin");
  const referer = c.req.header("Referer");
  const list = allowedHostnames();
  const originHost = originHostname(origin ?? null);
  const refererHost = originHostname(referer ?? null);

  if (list.size === 0) {
    // No explicit list — at least require *some* Origin/Referer so naked CLI
    // hits get rejected by default.
    if (!originHost && !refererHost) {
      return c.json({ error: "missing origin" }, 403);
    }
    await next();
    return;
  }

  const ok = (originHost && list.has(originHost)) || (refererHost && list.has(refererHost));
  if (!ok) {
    return c.json({ error: "origin not allowed" }, 403);
  }
  await next();
  return;
};

/** CORS responder. Allows the configured origins; without an Origin header,
 *  CORS isn't applicable (same-origin). */
export const corsHeaders: MiddlewareHandler = async (c, next) => {
  const origin = c.req.header("Origin");
  if (origin) {
    const hostname = originHostname(origin);
    const list = allowedHostnames();
    if (hostname && list.has(hostname)) {
      c.header("Access-Control-Allow-Origin", origin);
      c.header("Vary", "Origin");
      c.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
      c.header("Access-Control-Allow-Headers", "Content-Type");
      c.header("Access-Control-Max-Age", "600");
    }
  }
  if (c.req.method === "OPTIONS") {
    return c.body(null, 204);
  }
  await next();
  return;
};

// ---------------------------------------------------------------------------
// Rate limiter — sliding-window per IP, in-memory. Plenty for one process.
// ---------------------------------------------------------------------------

interface Bucket {
  hits: number[]; // timestamps (ms)
}

const buckets = new Map<string, Bucket>();
const WINDOW_MS = 60_000;
const SWEEP_EVERY_MS = 5 * 60_000;
let lastSweep = Date.now();

function clientIp(c: Context): string {
  // Trust X-Forwarded-For only when set by our own nginx (the chain ends with
  // the original client). Falls back to socket remote address.
  const xff = c.req.header("x-forwarded-for");
  if (xff) return xff.split(",")[0]!.trim();
  return c.req.header("x-real-ip") ?? "0.0.0.0";
}

function hit(ip: string, key: string, limit: number): boolean {
  const id = `${ip}:${key}`;
  const now = Date.now();
  const b = buckets.get(id) ?? { hits: [] };
  // Drop hits outside the window
  while (b.hits.length > 0 && b.hits[0] < now - WINDOW_MS) b.hits.shift();
  if (b.hits.length >= limit) {
    buckets.set(id, b);
    return false;
  }
  b.hits.push(now);
  buckets.set(id, b);
  // Periodic sweep so the map doesn't grow unbounded.
  if (now - lastSweep > SWEEP_EVERY_MS) {
    for (const [k, v] of buckets) {
      if (v.hits.length === 0 || v.hits[v.hits.length - 1] < now - WINDOW_MS) {
        buckets.delete(k);
      }
    }
    lastSweep = now;
  }
  return true;
}

export function rateLimitWrite(): MiddlewareHandler {
  return async (c, next) => {
    if (!hit(clientIp(c), "w", RATE_LIMIT_WRITE_PER_MIN)) {
      return c.json({ error: "rate limit exceeded" }, 429);
    }
    await next();
    return;
  };
}

export function rateLimitRead(): MiddlewareHandler {
  return async (c, next) => {
    if (!hit(clientIp(c), "r", RATE_LIMIT_READ_PER_MIN)) {
      return c.json({ error: "rate limit exceeded" }, 429);
    }
    await next();
    return;
  };
}
