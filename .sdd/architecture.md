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

- **640 × 360** logical. Game logic places the **640 × 320 playfield** at y 40..360 and reserves a **40 px HUD band** at y 0..40; physics, map generation, hand maps and replays all use these coordinates.
- On screen the band is drawn at the bottom: gameplay scenes draw the playfield shifted up by 40 px (`withPlayfield` in `src/render.ts`) and the HUD bar below it at y 320..360 (`withHudBar`). Touch layouts are in on-screen coordinates. A finger on a bar button then covers the bar, not the playfield.
- The app stretches the logical canvas over the whole window on both axes. The backing buffer is sized at native `devicePixelRatio`, and the same transform is inverted to map touch positions back to logical coordinates.
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

## Touch input

Touch support lives in `src/touch/`. Most of it is pure logic with no browser APIs: device classification, the touch-mode switch, control layouts in logical coordinates, hold-to-repeat timing, multi-touch tracking, back confirmation and the history guard for the system Back action. Scenes describe their touch controls through `touchLayout()`, and every control sends the same `InputEvent` the keyboard would into `Scene.handleEvent`, so there is no separate touch game logic.

A few thin files talk to the browser: `dom-input.ts` (media queries and pointer events), `dom-history.ts` (History API) and `draw.ts` (canvas drawing of controls).

Touch features only exist when the browser reports `(pointer: coarse)` and `(hover: none)`. With a mouse or trackpad as the main pointer, the game behaves as if touch support were not there.

The pure modules are the part the Rust/WASM rewrite (`specs/003-wasm/`) ports with their tests.

## See also

- `conventions.md` — coding standards
- `constitution.md` — non-negotiables
- `specs/001-initial-game/prd.md` — full product spec with all numbers and tables
