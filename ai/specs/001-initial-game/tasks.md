# Starball — Tasks

Last updated: 2026-05-15.

Living task tracker grouped by area. Spec lives in [`prd.md`](prd.md). Append new rows at the bottom of the relevant section; flip status as work progresses; do not delete completed rows — they are the audit trail.

## Status legend

- **Done** — landed on the main branch
- **Pending** — queued, scope is clear, not yet started
- **Draft** — described but not yet scoped or refined
- **Removed** — explicitly dropped from scope

## Core (physics, scoring, mapgen — shared by client and server replay)

|  #  | Task                                                                                         | Status  |
| --: | -------------------------------------------------------------------------------------------- | ------- |
| C1  | Entities: Asteroid, Star, Goal, Launcher, GameMap                                            | Done    |
| C2  | Velocity Verlet integrator with Plummer-softened Newtonian gravity                           | Done    |
| C3  | Blue-giant inverse-square repulsion within 2R                                                | Done    |
| C4  | Black-hole capped-pull model (never singular)                                                | Done    |
| C5  | Adaptive substepping (×2 within 3R, ×4 within 1.5R)                                          | Done    |
| C6  | Swept collision (segment-circle intersection) — prevents tunneling                           | Done    |
| C7  | Wall bounce with 90 % perpendicular damping                                                  | Done    |
| C8  | Hand-authored maps (5 in `handmaps.ts`)                                                      | Done    |
| C9  | Procedural map generation with shot-sampler solvability check                                | Done    |
| C10 | Mapgen fallback to hand-authored maps after 20 rejected attempts                             | Done    |
| C11 | Guarded curvature scoring (wall exclusion, per-star cap, time decay, global cap)             | Done    |
| C12 | Grazing bonus per star encountered                                                           | Done    |
| C13 | Flight-time multiplier (1.0 grace 6 s, decays to 0.3 floor over 14 s)                        | Done    |
| C14 | Black-hole tuning: `aMax` 1600 → 5000                                                        | Done    |
| C15 | Physics tests: integrator stability, known-deflection, swept-collision capture               | Done    |
| C16 | Scoring tests: straight-line low, slingshot high, orbit-farm capped, walls excl.             | Done    | 
| C17 | Limit the number of lives to 5 max                                                           | Done    |
| C18 | Blue and Red Giants size can be variable within a range of 1x to 2x times their current size | Done    |

## Frontend (scenes, UI, input, render, audio)

|  #  | Task                                                                             | Status  |
| --: | -------------------------------------------------------------------------------- | ------- |
| F1  | Vite + TypeScript ESM scaffold (`npm run dev` on :5173)                          | Done    |
| F2  | Fixed 640×360 logical canvas, integer-scaled to viewport, CSS letterbox          | Done    |
| F3  | Scene base class + scene stack in `app.ts`                                       | Done    |
| F4  | Turn-based aim state (angle, power, Shift multiplier, R reset)                   | Done    |
| F5  | Renderer: HUD band, sprites, particles, trail, gravity-field overlay             | Done    |
| F6  | Full shot flow: aim → fire → simulate → end-condition → next shot                | Done    |
| F7  | Goal-circle detection                                                            | Done    |
| F8  | Main menu with scene transitions                                                 | Done    |
| F9  | Settings scene with all toggles                                                  | Done    |
| F10 | Per-mode high-scores display                                                     | Done    |
| F11 | 3-letter initials entry on top-10 score                                          | Done    |
| F12 | Battle (2P hot-seat): alternating starts, dual scoreboards, configurable rounds  | Done    |
| F13 | Training scene: new-map, handmap-cycle, preview toggle                           | Done    |
| F14 | Web Audio synthesised SFX (fire, bounce, crash, score, assist, menu_*)           | Done    |
| F15 | Procedurally drawn sprite cache (DawnBringer 32 enforced by construction)        | Done    |
| F16 | Rename Sandbox menu option to "Training" (label + HUD title)                     | Done    |
| F17 | Move version off menu, into page title (`Starball v1.0.0`)                       | Done    |
| F18 | Initials confirmation: Enter advances cursor, double-confirm to submit           | Done    |
| F19 | Remove "full" trajectory preview from settings UI (leaderboard fairness)         | Done    |
| F20 | Per-difficulty Play leaderboard UI (←/→ to switch)                               | Done    |
| F21 | Help page — star reference with live sprites and gravity blurbs                  | Done    |
| F22 | Audio polish: rename `+graze` → `+bonus`, suppress on crash, redesign crash SFX  | Done    |
| F23 | Training: gravity-field heatmap toggled by **G** (log-scaled, cached offscreen)  | Done    |
| F24 | Battle config: 3 shots/round, default 4 rounds, alternating starts               | Done    |
| F25 | Play: +1 life on each scored goal (unlimited unaffected)                         | Done    |
| F26 | Remove QUIT menu item and dead shutdown plumbing                                 | Done    |
| F27 | Menu byline: "by Xose Pérez" subtitle                                            | Done    |
| F28 | Music loops for menu and gameplay (Web Audio synth, not files)                   | Pending |
| F29 | Black-hole accretion-ring animation (visual polish)                              | Pending |
| F30 | Trajectory preview honors difficulty (off / first second / full per difficulty)  | Draft   |
| F31 | Mobile / touch input (own design pass)                                           | Draft   |
| F32 | Upon goal, keep the score on screen until the user presses a key                 | Done    |
| F33 | Help scene paginated (←/→); page 2 explains scoring (auto-tracks config constants)| Done    |

## Persistence (localStorage)

|  # | Task                                                                  | Status |
| --:| --------------------------------------------------------------------- | ------ |
| S1 | localStorage with versioned schemas (settings, highscores)            | Done   |
| S2 | In-memory fallback when localStorage is unavailable                   | Done   |
| S3 | Corruption-safe defaults on parse error or version mismatch           | Done   |

## Backend (Hono + better-sqlite3)

|  #  | Task                                                                        | Status  |
| --: | --------------------------------------------------------------------------- | ------- |
| B1  | Backend scaffold (Hono, tsx, package layout, env-driven config)             | Done    |
| B2  | SQLite storage layer (scores + sessions, WAL, prepared statements)          | Done    |
| B3  | Baseline security middleware (Origin/Referer, sliding-window rate limits)   | Done    |
| B4  | Ephemeral single-use session tokens (24-char nanoid, TTL 900 s)             | Done    |
| B5  | Replay validation re-running client-side physics on the server              | Done    |
| B6  | Frontend captures shot transcripts during Play                              | Done    |
| B7  | Frontend remote-persistence client with offline localStorage fallback       | Done    |
| B8  | End-to-end smoke + README integration                                       | Done    |
| B9  | Per-difficulty leaderboard partition (schema v2 + SQLite ALTER + API filter)| Done    |
| B10 | Optional `MAX_REPLAY_SHOTS` audit log so repeated 400s per IP are tracked   | Pending |
| B11 | Prune `scores` table beyond top-100 per partition (currently unbounded)     | Pending |

## Packaging / DevOps

|  # | Task                                                                                  | Status  |
| --:| ------------------------------------------------------------------------------------- | ------- |
| P1 | Vite static build → `./dist`                                                          | Done    |
| P2 | Multi-stage Dockerfile collapsing SPA + API into a single ~270 MB image               | Done    |
| P3 | `docker-compose.yml` with named volume for SQLite                                     | Done    |
| P4 | Health checks against 127.0.0.1 (Alpine `localhost` resolves to ::1, v4-only listener)| Done    |
| P5 | Traefik integration documented inline in compose                                      | Done    |
| P6 | Build a hosted instance and pin a public origin in `ALLOWED_ORIGINS`                  | Pending |

## Verification

Automated (`npm test` from repo root):

- 61 vitest tests across physics, scoring, mapgen, input, persistence.
- TypeScript clean (`npx tsc --noEmit` in both client and `server/`).

End-to-end manual (when a change touches the wire format):

1. `docker compose up -d --build`; verify `:8080` serves the SPA and `/api/scores?mode=endless&difficulty=normal` returns JSON.
2. Score a Play run, enter initials, verify it appears in the table for the current difficulty (and not in another).
3. Replay validation: hostile claim with no transcript → 400; bogus transcript → 400; real transcript matching server-side recompute → 200.
4. `docker compose down` then `up` — table persists. `docker compose down -v` — table wiped.

## How to use this document

- Update **Status** in-place as work moves. Don't delete completed rows — they're the audit trail.
- Add new rows at the bottom of the relevant section. If a row doesn't fit any section, add the section.
- When picking up work in a fresh session, scan the legend, then this file, then `prd.md`.
