// Game server entry point. Serves both the SPA bundle and the JSON API.

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { Hono } from "hono";
import { nanoid } from "nanoid";

import { HOST, MAX_SCORE, PORT, SESSION_TTL_SECONDS } from "./config.js";
import {
  consumeSession,
  createSession,
  type Difficulty,
  insertScore,
  type Mode,
  pruneOldSessions,
  topScores,
} from "./db.js";

const DIFFICULTIES: ReadonlySet<Difficulty> = new Set(["gentle", "normal", "hard"]);
import {
  corsHeaders,
  rateLimitRead,
  rateLimitWrite,
  requireAllowedOrigin,
} from "./security.js";
import { type ShotTranscript, validateReplay } from "./replay.js";

const app = new Hono();

app.use("*", corsHeaders);

// Health check (no rate limit, no auth)
app.get("/health", (c) => c.json({ ok: true }));

// ---------------------------------------------------------------------------
// GET /api/scores?mode=endless — public read
// ---------------------------------------------------------------------------

app.get("/api/scores", rateLimitRead(), (c) => {
  const mode = c.req.query("mode");
  if (mode !== "endless" && mode !== "hotseat") {
    return c.json({ error: "invalid mode" }, 400);
  }
  let difficulty: Difficulty | null = null;
  if (mode === "endless") {
    const d = c.req.query("difficulty");
    if (d !== undefined) {
      if (!DIFFICULTIES.has(d as Difficulty)) {
        return c.json({ error: "invalid difficulty" }, 400);
      }
      difficulty = d as Difficulty;
    }
  }
  const rows = topScores(mode, difficulty);
  return c.json({ mode, difficulty, scores: rows });
});

// ---------------------------------------------------------------------------
// POST /api/session — request a single-use submission token
// ---------------------------------------------------------------------------

app.post("/api/session", requireAllowedOrigin, rateLimitWrite(), async (c) => {
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "invalid json" }, 400);
  }
  const mode = (body as { mode?: unknown }).mode;
  if (mode !== "endless" && mode !== "hotseat") {
    return c.json({ error: "invalid mode" }, 400);
  }
  pruneOldSessions(SESSION_TTL_SECONDS * 1000);
  const token = nanoid(24);
  createSession(token, mode);
  return c.json({ token, ttlSeconds: SESSION_TTL_SECONDS });
});

// ---------------------------------------------------------------------------
// POST /api/scores — submit a score
// ---------------------------------------------------------------------------

interface ScoreSubmission {
  token: string;
  mode: Mode;
  name: string;
  score: number;
  seed: number | null;
  startingLives?: number;
  shots?: ShotTranscript[];
  difficulty?: Difficulty;
}

function validateName(s: unknown): string | null {
  if (typeof s !== "string") return null;
  const trimmed = s.trim().toUpperCase();
  if (trimmed.length === 0) return null;
  const clipped = trimmed.substring(0, 3);
  if (!/^[A-Z0-9-]{1,3}$/.test(clipped)) return null;
  return clipped.padEnd(3, " ").slice(0, 3);
}

app.post("/api/scores", requireAllowedOrigin, rateLimitWrite(), async (c) => {
  let body: ScoreSubmission;
  try {
    body = (await c.req.json()) as ScoreSubmission;
  } catch {
    return c.json({ error: "invalid json" }, 400);
  }

  // Shape checks
  if (!body || typeof body !== "object") {
    return c.json({ error: "invalid body" }, 400);
  }
  if (body.mode !== "endless" && body.mode !== "hotseat") {
    return c.json({ error: "invalid mode" }, 400);
  }
  const name = validateName(body.name);
  if (name === null) {
    return c.json({ error: "invalid name" }, 400);
  }
  if (
    !Number.isFinite(body.score) ||
    body.score < 0 ||
    body.score > MAX_SCORE
  ) {
    return c.json({ error: "score out of range" }, 400);
  }
  if (typeof body.token !== "string" || body.token.length === 0) {
    return c.json({ error: "missing token" }, 400);
  }
  let difficulty: Difficulty = "normal";
  if (body.mode === "endless") {
    if (body.difficulty === undefined) {
      return c.json({ error: "missing difficulty" }, 400);
    }
    if (!DIFFICULTIES.has(body.difficulty)) {
      return c.json({ error: "invalid difficulty" }, 400);
    }
    difficulty = body.difficulty;
  }

  // Token must be valid AND issued for this mode AND not expired.
  pruneOldSessions(SESSION_TTL_SECONDS * 1000);
  const sess = consumeSession(body.token);
  if (sess === null) {
    return c.json({ error: "invalid or used token" }, 401);
  }
  if (sess.mode !== body.mode) {
    return c.json({ error: "mode/token mismatch" }, 401);
  }
  const ageMs = Date.now() - sess.issued;
  if (ageMs > SESSION_TTL_SECONDS * 1000) {
    return c.json({ error: "token expired" }, 401);
  }

  // Replay validation. Currently only endless mode ships a transcript; for
  // hotseat we trust the claim (it's a local two-player score on a shared
  // device; not really a leaderboard cheating vector).
  if (body.mode === "endless") {
    if (!Array.isArray(body.shots) || body.shots.length === 0) {
      return c.json({ error: "missing replay transcript" }, 400);
    }
    const startingLives = typeof body.startingLives === "number" ? body.startingLives : 3;
    const replay = validateReplay({
      shots: body.shots,
      claimedScore: body.score,
      startingLives,
    });
    if (!replay.ok) {
      return c.json({ error: `replay rejected: ${replay.reason}` }, 400);
    }
  }

  const { rank } = insertScore(
    body.mode,
    name,
    Math.floor(body.score),
    body.seed ?? null,
    difficulty,
  );
  return c.json({ ok: true, rank, name });
});

// ---------------------------------------------------------------------------
// Static SPA bundle
// ---------------------------------------------------------------------------
//
// In a Docker build the bundle is copied to /app/server/public. In `npm run
// dev` it may or may not exist depending on whether you ran `npm run build`
// in the parent project — if it's absent we just skip the static handlers
// and the API endpoints still work.

const PUBLIC_DIR = resolve(process.cwd(), "public");
const INDEX_HTML_PATH = resolve(PUBLIC_DIR, "index.html");
const hasBundle = existsSync(INDEX_HTML_PATH);
const indexHtml = hasBundle ? readFileSync(INDEX_HTML_PATH, "utf-8") : null;

if (hasBundle) {
  // Hashed asset files — safe to cache for a year (filenames include the
  // content hash, so any change produces a new URL).
  app.use(
    "/assets/*",
    async (c, next) => {
      await next();
      c.header("Cache-Control", "public, max-age=31536000, immutable");
    },
    serveStatic({ root: "./public" }),
  );

  // SPA shell.
  app.get("/", (c) => {
    c.header("Cache-Control", "no-cache, no-store, must-revalidate");
    return c.html(indexHtml!);
  });
}

// ---------------------------------------------------------------------------
// 404 / SPA fallback
// ---------------------------------------------------------------------------

app.notFound((c) => {
  const path = c.req.path;
  // API and asset paths legitimately 404 — no SPA fallback for them.
  if (path.startsWith("/api/") || path.startsWith("/assets/") || path === "/health") {
    return c.json({ error: "not found" }, 404);
  }
  // Anything else is a client-side route; serve the SPA shell so the
  // router can resolve it in the browser.
  if (hasBundle) {
    c.header("Cache-Control", "no-cache, no-store, must-revalidate");
    return c.html(indexHtml!);
  }
  return c.json({ error: "not found" }, 404);
});

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------

serve({ fetch: app.fetch, port: PORT, hostname: HOST }, ({ address, port }) => {
  // eslint-disable-next-line no-console
  console.log(`starball-api listening on http://${address}:${port}`);
});
