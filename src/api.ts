// Thin client for the shared high-score API. All calls are best-effort: on
// network error / non-2xx / unparseable JSON, they return null. Callers fall
// back to localStorage so the game still works offline (or before the backend
// is deployed).

import type { DifficultyCurve } from "./config";
import type { HighscoreEntry, HighscoreMode, ShotTranscript } from "./persistence";

const API_BASE = "/api";
const REQUEST_TIMEOUT_MS = 4000;

interface ScoresResponse {
  mode: HighscoreMode;
  scores: HighscoreEntry[];
}

interface SessionResponse {
  token: string;
  ttlSeconds: number;
}

interface SubmitResponse {
  ok: boolean;
  rank: number;
  name: string;
}

async function fetchWithTimeout(url: string, init?: RequestInit): Promise<Response> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: ctrl.signal });
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchRemoteScores(
  mode: HighscoreMode,
  difficulty?: DifficultyCurve,
): Promise<HighscoreEntry[] | null> {
  try {
    const url = new URL(`${API_BASE}/scores`, globalThis.location?.href ?? "http://localhost/");
    url.searchParams.set("mode", mode);
    if (mode === "endless" && difficulty) url.searchParams.set("difficulty", difficulty);
    const res = await fetchWithTimeout(`${url.pathname}${url.search}`);
    if (!res.ok) return null;
    const body = (await res.json()) as ScoresResponse;
    if (!body || !Array.isArray(body.scores)) return null;
    return body.scores;
  } catch {
    return null;
  }
}

export interface SubmitOpts {
  mode: HighscoreMode;
  name: string;
  score: number;
  seed: number | null;
  startingLives?: number;
  shots?: ShotTranscript[];
  difficulty?: DifficultyCurve;
}

export interface SubmitResult {
  rank: number;
  name: string;
}

export async function submitRemoteScore(opts: SubmitOpts): Promise<SubmitResult | null> {
  try {
    const sessRes = await fetchWithTimeout(`${API_BASE}/session`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode: opts.mode }),
    });
    if (!sessRes.ok) return null;
    const sess = (await sessRes.json()) as SessionResponse;
    if (!sess.token) return null;

    const scoreRes = await fetchWithTimeout(`${API_BASE}/scores`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        token: sess.token,
        mode: opts.mode,
        name: opts.name,
        score: opts.score,
        seed: opts.seed,
        startingLives: opts.startingLives,
        shots: opts.shots,
        difficulty: opts.difficulty,
      }),
    });
    if (!scoreRes.ok) return null;
    const body = (await scoreRes.json()) as SubmitResponse;
    if (!body.ok) return null;
    return { rank: body.rank, name: body.name };
  } catch {
    return null;
  }
}
