# Architecture

A stable, project-wide map of how Starball is put together. Update only when the topology changes.

## What this repo ships

A single Docker image that serves both:

- a static SPA bundle (TypeScript + Vite, plain HTML5 Canvas, no framework), and
- a Node + Hono API backed by `better-sqlite3` for shared high scores.

Hono listens on `:3000` inside the container; `docker-compose.yml` maps it to `:8080` on the host.

## Process / module layout

```
┌────────────────────────────────────────────────────────────┐
│ Browser (the SPA)                                          │
│   src/                                                     │
│     ├── physics, scoring, mapgen          ─── shared ──┐   │
│     ├── input, audio, sprites, render                  │   │
│     └── persistence (localStorage)                     │   │
└──────────────────────────────┬─────────────────────────┼───┘
                               │ HTTP /api/*             │
┌──────────────────────────────▼─────────────────────────▼───┐
│ Hono container (:3000)                                     │
│   server/src/                                              │
│     ├── routes (sessions, scores read/write)               │
│     ├── security.ts  (Origin/Referer + sliding-window RL)  │
│     └── replay.ts    (re-runs shared physics+scoring)      │
│   SQLite volume: starball-data                             │
└────────────────────────────────────────────────────────────┘
```

The arrow that says "shared" is the load-bearing one: physics, scoring, and mapgen modules under `src/` are imported by the server's replay validator. The server does not reimplement them.

## Fixed logical canvas

- **640 × 360** logical, with a **40 px HUD band** on top and a **640 × 320 playfield** below.
- App scales by the largest integer factor that fits the viewport (`min(host_w / 640, host_h / 360)`), CSS-centered, letterboxed.
- HiDPI handled via `devicePixelRatio`.

## Persistence split

| Where         | What                                              | Notes                                            |
| ------------- | ------------------------------------------------- | ------------------------------------------------ |
| `localStorage` | settings, offline high-score cache                | versioned schemas, corruption-safe defaults      |
| SQLite volume | shared online high scores                         | volume `starball-data`, survives `compose down`  |

## Security model

Anti-cheat for the shared leaderboard lives in two files:

- `server/src/security.ts` — Origin / Referer enforcement, per-IP sliding-window rate limits (reads + writes), single-use session tokens.
- `server/src/replay.ts` — re-runs the per-shot transcript through the shared physics/scoring modules and rejects submissions that don't match the claimed total within tolerance.

Endless mode is replay-validated. Battle is token-gated only — it's a couch game; leaderboard cheating is not the threat model.

## Why one container

Same Origin between SPA and API simplifies anti-cheat (Origin/Referer checks just work) and removes a CORS class of bugs. The cost — coupling SPA build and API process in one image — is acceptable for a project this size.

## See also

- `conventions.md` — coding standards
- `constitution.md` — non-negotiables
- `specs/001-initial-game/prd.md` — full product spec with all numbers and tables
