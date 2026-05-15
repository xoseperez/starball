// Server configuration sourced from environment variables.

function intEnv(name: string, def: number): number {
  const v = process.env[name];
  if (v === undefined || v === "") return def;
  const n = Number(v);
  return Number.isFinite(n) ? n : def;
}

function strEnv(name: string, def: string): string {
  const v = process.env[name];
  return v === undefined || v === "" ? def : v;
}

function listEnv(name: string, def: string[]): string[] {
  const v = process.env[name];
  if (v === undefined || v === "") return def;
  return v.split(",").map((s) => s.trim()).filter((s) => s.length > 0);
}

export const PORT = intEnv("PORT", 3000);
export const HOST = strEnv("HOST", "0.0.0.0");

// Where the SQLite file lives. In the container this maps to the named volume.
export const DB_PATH = strEnv("DB_PATH", "/var/lib/starball/scores.db");

// Comma-separated list of allowed origins for CORS + Referer checks.
// Empty list (default) means allow same-origin only (no cross-origin requests).
export const ALLOWED_ORIGINS = listEnv("ALLOWED_ORIGINS", []);

// Rate limiting — soft sliding-window per IP.
export const RATE_LIMIT_WRITE_PER_MIN = intEnv("RATE_LIMIT_WRITE_PER_MIN", 10);
export const RATE_LIMIT_READ_PER_MIN = intEnv("RATE_LIMIT_READ_PER_MIN", 60);

// Session token lifetime (seconds). Tokens are single-use.
export const SESSION_TTL_SECONDS = intEnv("SESSION_TTL_SECONDS", 15 * 60);

// Score sanity bounds — anything outside is rejected before replay validation
// even runs. Tune to your expected max scores.
export const MAX_SCORE = intEnv("MAX_SCORE", 1_000_000);

// Replay validation: maximum total simulated time we'll allow for a single
// submission (protects against DOS via long transcripts).
export const REPLAY_MAX_SIM_SECONDS = intEnv("REPLAY_MAX_SIM_SECONDS", 600);
// Max shots per submission. Plenty for typical Play runs.
export const REPLAY_MAX_SHOTS = intEnv("REPLAY_MAX_SHOTS", 200);
// Allowed difference between claimed and computed score (float tolerance).
export const REPLAY_SCORE_TOLERANCE = intEnv("REPLAY_SCORE_TOLERANCE", 2);
