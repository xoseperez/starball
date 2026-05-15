// SQLite schema + access. better-sqlite3 is synchronous which is the right
// model for a tiny single-process server.

import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";

import { DB_PATH } from "./config.js";

let dbInstance: Database.Database | null = null;

function db(): Database.Database {
  if (dbInstance !== null) return dbInstance;
  mkdirSync(dirname(DB_PATH), { recursive: true });
  dbInstance = new Database(DB_PATH);
  dbInstance.pragma("journal_mode = WAL");
  dbInstance.pragma("synchronous = NORMAL");
  initSchema(dbInstance);
  return dbInstance;
}

function initSchema(d: Database.Database): void {
  // Tables first. CREATE IF NOT EXISTS is a no-op against an existing table
  // (it does NOT add new columns), so an older deployment that's missing
  // `difficulty` keeps its old shape until the ALTER below runs.
  d.exec(`
    CREATE TABLE IF NOT EXISTS scores (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      mode       TEXT    NOT NULL CHECK (mode IN ('endless', 'hotseat')),
      name       TEXT    NOT NULL,
      score      INTEGER NOT NULL,
      seed       INTEGER,
      date       TEXT    NOT NULL,
      created    INTEGER NOT NULL,
      difficulty TEXT    NOT NULL DEFAULT 'normal'
    );

    CREATE TABLE IF NOT EXISTS sessions (
      token   TEXT    PRIMARY KEY,
      mode    TEXT    NOT NULL CHECK (mode IN ('endless', 'hotseat')),
      issued  INTEGER NOT NULL,
      used    INTEGER NOT NULL DEFAULT 0
    );
  `);

  // Migration: pre-existing scores from before v1.1 lack the column.
  const cols = d.prepare("PRAGMA table_info(scores)").all() as Array<{ name: string }>;
  if (!cols.some((c) => c.name === "difficulty")) {
    d.exec("ALTER TABLE scores ADD COLUMN difficulty TEXT NOT NULL DEFAULT 'normal'");
  }

  // Indexes last — safe to reference `difficulty` now that it definitely exists.
  d.exec(`
    CREATE INDEX IF NOT EXISTS scores_by_mode ON scores (mode, score DESC);
    CREATE INDEX IF NOT EXISTS scores_by_mode_difficulty
      ON scores (mode, difficulty, score DESC);
    CREATE INDEX IF NOT EXISTS sessions_by_issued ON sessions (issued);
  `);
}

// ---------------------------------------------------------------------------
// Scores
// ---------------------------------------------------------------------------

export interface ScoreRow {
  name: string;
  score: number;
  seed: number | null;
  date: string;
  difficulty: Difficulty;
}

export type Mode = "endless" | "hotseat";
export type Difficulty = "gentle" | "normal" | "hard";

export function topScores(
  mode: Mode,
  difficulty: Difficulty | null = null,
  limit = 10,
): ScoreRow[] {
  if (mode === "endless" && difficulty) {
    return db().prepare<[Mode, Difficulty, number], ScoreRow>(
      "SELECT name, score, seed, date, difficulty FROM scores WHERE mode = ? AND difficulty = ? ORDER BY score DESC, created ASC LIMIT ?",
    ).all(mode, difficulty, limit);
  }
  return db().prepare<[Mode, number], ScoreRow>(
    "SELECT name, score, seed, date, difficulty FROM scores WHERE mode = ? ORDER BY score DESC, created ASC LIMIT ?",
  ).all(mode, limit);
}

export function insertScore(
  mode: Mode,
  name: string,
  score: number,
  seed: number | null,
  difficulty: Difficulty = "normal",
): { rank: number } {
  const date = new Date().toISOString().slice(0, 10);
  const now = Date.now();
  db().prepare(
    "INSERT INTO scores (mode, name, score, seed, date, created, difficulty) VALUES (?, ?, ?, ?, ?, ?, ?)",
  ).run(mode, name, score, seed, date, now, difficulty);

  // Compute 1-based rank within the partition this entry belongs to.
  const ranks = mode === "endless"
    ? db().prepare<[Mode, Difficulty], ScoreRow & { id: number }>(
        "SELECT id, name, score, seed, date, difficulty FROM scores WHERE mode = ? AND difficulty = ? ORDER BY score DESC, created ASC LIMIT 10",
      ).all(mode, difficulty)
    : db().prepare<[Mode], ScoreRow & { id: number }>(
        "SELECT id, name, score, seed, date, difficulty FROM scores WHERE mode = ? ORDER BY score DESC, created ASC LIMIT 10",
      ).all(mode);
  const lastInsert = db().prepare<[], { id: number }>("SELECT last_insert_rowid() AS id").get();
  if (!lastInsert) return { rank: 0 };
  for (let i = 0; i < ranks.length; i++) {
    if ((ranks[i] as ScoreRow & { id: number }).id === lastInsert.id) {
      return { rank: i + 1 };
    }
  }
  return { rank: 0 };
}

// ---------------------------------------------------------------------------
// Sessions (single-use ephemeral tokens)
// ---------------------------------------------------------------------------

export function createSession(token: string, mode: Mode): void {
  db().prepare(
    "INSERT INTO sessions (token, mode, issued, used) VALUES (?, ?, ?, 0)",
  ).run(token, mode, Date.now());
}

export interface Session {
  token: string;
  mode: Mode;
  issued: number;
  used: 0 | 1;
}

export function consumeSession(token: string): Session | null {
  const sess = db().prepare<[string], Session>(
    "SELECT token, mode, issued, used FROM sessions WHERE token = ?",
  ).get(token);
  if (!sess) return null;
  if (sess.used !== 0) return null;
  db().prepare("UPDATE sessions SET used = 1 WHERE token = ?").run(token);
  return sess;
}

export function pruneOldSessions(olderThanMs: number): void {
  const cutoff = Date.now() - olderThanMs;
  db().prepare("DELETE FROM sessions WHERE issued < ?").run(cutoff);
}
