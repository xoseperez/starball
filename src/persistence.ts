// Persistence via localStorage with version handling + corruption recovery.
// Drops to an in-memory shim if localStorage is unavailable (e.g. tests,
// private-mode browsers, sandboxed iframes), so the rest of the game keeps
// working — just without persisting across sessions.

import { DEFAULT_SETTINGS, type DifficultyCurve, type Settings } from "./config";

export const SETTINGS_VERSION = 1;
// v2: endless entries now carry a `difficulty` tag and the top-10 cut is
// per-difficulty. Old v1 data is dropped on load (acceptable since the prior
// leaderboard mixed difficulties unfairly anyway).
export const HIGHSCORES_VERSION = 2;

export const SETTINGS_KEY = "starball.settings";
export const HIGHSCORES_KEY = "starball.highscores";

export type HighscoreMode = "endless" | "hotseat";

export interface HighscoreEntry {
  name: string;
  score: number;
  date: string;
  seed: number | null;
  // Present on endless entries (one of "gentle" | "normal" | "hard"). Always
  // absent on hotseat entries — battle is local 2P, difficulty is not part
  // of the scoring contract there.
  difficulty?: DifficultyCurve;
}

// One shot the player fired. Used by the remote backend to replay the run and
// verify the claimed score; local storage doesn't need it.
export interface ShotTranscript {
  level: number;
  mapSeed: number;
  angleDeg: number;
  powerPct: number;
}

export interface HighscoreData {
  version: number;
  endless: HighscoreEntry[];
  hotseat: HighscoreEntry[];
}

// ---------------------------------------------------------------------------
// Storage abstraction — accepts anything with Web Storage API shape
// ---------------------------------------------------------------------------

export interface KVStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

class MemoryStore implements KVStore {
  private map = new Map<string, string>();
  getItem(key: string): string | null {
    return this.map.has(key) ? this.map.get(key)! : null;
  }
  setItem(key: string, value: string): void {
    this.map.set(key, value);
  }
  removeItem(key: string): void {
    this.map.delete(key);
  }
}

function defaultStore(): KVStore {
  try {
    if (
      typeof globalThis !== "undefined" &&
      "localStorage" in globalThis &&
      (globalThis as { localStorage?: KVStore }).localStorage
    ) {
      const ls = (globalThis as { localStorage: KVStore }).localStorage;
      // Probe (private mode can throw)
      const probe = "__starball_probe__";
      ls.setItem(probe, "1");
      ls.removeItem(probe);
      return ls;
    }
  } catch {
    /* fall through */
  }
  return new MemoryStore();
}

let activeStore: KVStore = defaultStore();

export function setStore(store: KVStore): void {
  activeStore = store;
}

export function resetStoreForTests(): void {
  activeStore = new MemoryStore();
}

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

export function loadSettings(): Settings {
  const raw = activeStore.getItem(SETTINGS_KEY);
  if (!raw) return { ...DEFAULT_SETTINGS };
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    return { ...DEFAULT_SETTINGS };
  }
  const obj = data as Record<string, unknown>;
  if (obj.version !== SETTINGS_VERSION) {
    return { ...DEFAULT_SETTINGS };
  }
  const merged: Settings = { ...DEFAULT_SETTINGS };
  for (const k of Object.keys(DEFAULT_SETTINGS) as Array<keyof Settings>) {
    if (k === "version") continue;
    if (k in obj && typeof obj[k] === typeof DEFAULT_SETTINGS[k]) {
      // Shape already validated by the typeof check; cast through unknown.
      (merged as unknown as Record<string, unknown>)[k] = obj[k];
    }
  }
  merged.version = SETTINGS_VERSION;
  return merged;
}

export function saveSettings(s: Settings): void {
  const payload = { ...s, version: SETTINGS_VERSION };
  try {
    activeStore.setItem(SETTINGS_KEY, JSON.stringify(payload));
  } catch {
    /* quota or security error — swallow silently */
  }
}

// ---------------------------------------------------------------------------
// Highscores
// ---------------------------------------------------------------------------

export function emptyHighscores(): HighscoreData {
  return { version: HIGHSCORES_VERSION, endless: [], hotseat: [] };
}

export function loadHighscores(): HighscoreData {
  const raw = activeStore.getItem(HIGHSCORES_KEY);
  if (!raw) return emptyHighscores();
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return emptyHighscores();
  }
  if (!data || typeof data !== "object" || Array.isArray(data)) return emptyHighscores();
  const obj = data as Record<string, unknown>;
  if (obj.version !== HIGHSCORES_VERSION) return emptyHighscores();
  const out = emptyHighscores();
  for (const mode of ["endless", "hotseat"] as const) {
    const raw = obj[mode];
    if (Array.isArray(raw)) {
      out[mode] = raw.filter(
        (e: unknown) =>
          e !== null &&
          typeof e === "object" &&
          typeof (e as HighscoreEntry).name === "string" &&
          typeof (e as HighscoreEntry).score === "number",
      ) as HighscoreEntry[];
    }
  }
  return out;
}

/** Top 10 entries for a mode, filtered by difficulty when endless. */
export function topEntries(
  data: HighscoreData,
  mode: HighscoreMode,
  difficulty?: DifficultyCurve,
): HighscoreEntry[] {
  const all = data[mode];
  const filtered = mode === "endless" && difficulty
    ? all.filter((e) => e.difficulty === difficulty)
    : all;
  return [...filtered].sort((a, b) => b.score - a.score).slice(0, 10);
}

export function saveHighscores(data: HighscoreData): void {
  const payload = { ...data, version: HIGHSCORES_VERSION };
  try {
    activeStore.setItem(HIGHSCORES_KEY, JSON.stringify(payload));
  } catch {
    /* swallow */
  }
}

export interface AddOpts {
  mode: HighscoreMode;
  name: string;
  score: number;
  seed?: number | null;
  difficulty?: DifficultyCurve;
}

/**
 * Insert a new score, keep top 10 per (mode, difficulty) partition, save, and
 * return the 1-based rank the entry landed at within its partition (or 0 if
 * it didn't make the table).
 */
export function addHighscore(opts: AddOpts): number {
  const data = loadHighscores();
  const entry: HighscoreEntry = {
    name: (opts.name || "???").substring(0, 3).toUpperCase(),
    score: Math.floor(opts.score),
    date: todayISO(),
    seed: opts.seed ?? null,
    ...(opts.mode === "endless" && opts.difficulty ? { difficulty: opts.difficulty } : {}),
  };
  // Keep entries from OTHER difficulty partitions intact; prune only the
  // entry's own partition to top 10.
  const otherPartitions = data[opts.mode].filter((e) =>
    opts.mode === "endless"
      ? e.difficulty !== opts.difficulty
      : false,
  );
  const ownPartition = data[opts.mode].filter((e) =>
    opts.mode === "endless"
      ? e.difficulty === opts.difficulty
      : true,
  );
  const newOwn = [...ownPartition, entry]
    .sort((a, b) => b.score - a.score)
    .slice(0, 10);
  data[opts.mode] = [...otherPartitions, ...newOwn];
  saveHighscores(data);
  const idx = newOwn.findIndex((e) => e === entry);
  return idx >= 0 ? idx + 1 : 0;
}

export function qualifiesForHighscore(
  mode: HighscoreMode,
  score: number,
  difficulty?: DifficultyCurve,
): boolean {
  const data = loadHighscores();
  const table = topEntries(data, mode, difficulty);
  if (table.length < 10) return score > 0;
  return score > table[table.length - 1].score;
}

function todayISO(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}
