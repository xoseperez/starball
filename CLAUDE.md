# Starball — session bootstrap

> If you're picking up a conversation that's working with this project from a parent directory, read this first.

## Project

Starball is a single-page TypeScript + HTML5 Canvas browser game (gravity-puzzle / Pocket-Tanks-style arcade). Same repo also ships a Node + SQLite backend (Hono) that stores shared high scores and replay-validates them against the same physics the client runs.

One container, one image: `docker compose up -d` brings up Hono on `:3000` serving both the static SPA bundle and the `/api/*` endpoints; the host port maps to `:8080` by default.

## Switching into this project

```sh
cd /home/xose/workspace/personal/starball-web
```

All commands below assume you're inside that directory.

## Common commands

```sh
# Frontend (Vite + Vitest)
npm install
npm run dev          # vite dev server on http://localhost:5173 (proxies /api → :3000)
npm test             # vitest run (61 tests, pure logic)
npm run build        # static bundle in ./dist
npm run preview      # serve the built bundle locally

# Backend (Hono + better-sqlite3, run via tsx — no compile step)
cd server
npm install
npm run dev          # tsx watch on http://localhost:3000
npm run typecheck

# Full stack via Docker
docker compose up -d --build       # http://localhost:8080
docker compose down                # stop, keep volume (high scores persist)
docker compose down -v             # stop and wipe scores
```

## Layout

```
starball-web/
├── CLAUDE.md           ← you are here
├── docs/
│   ├── PRD.md          ← product requirements (high-level game spec)
│   └── TASKS.md        ← task tracker grouped by area (status: Done / Pending / Draft / Removed)
├── .ai/
│   └── tasks.md        ← user's running TODO list (informal)
├── README.md           ← public-facing
├── index.html, vite.config.ts, tsconfig.json, package.json
├── src/                ← frontend (TypeScript)
├── server/             ← Hono API + replay validator
├── tests/              ← vitest suites
├── Dockerfile          ← multi-stage: builds SPA + API into one image
└── docker-compose.yml
```

## Conventions

- **TypeScript ESM** throughout. `tsx` runs server modules directly (no compile). Shared modules under `src/` (physics, scoring, mapgen) are imported by both client and server replay validator.
- **Fixed logical canvas 640×360**, 40 px HUD on top, 640×320 playfield below. App scales by integer factor to fit viewport.
- **DawnBringer 32 palette** in `src/config.ts`. Sprites are procedurally generated to `HTMLCanvasElement` (`src/sprites.ts`) — no PNG assets shipped.
- **Audio is synthesized** via Web Audio API. No SFX/music files.
- **Tests are pure logic** (physics, scoring, mapgen, input, persistence). No DOM/canvas tests. Run with `npm test`.
- **Persistence**: `localStorage` (versioned schemas) for settings + offline high-score cache; SQLite (volume `starball-data`) for shared online scores.
- **No emojis in code or commits unless asked.** Default to terse commits and zero comments unless WHY is non-obvious.

## Where to find what

- **Specs**: `docs/PRD.md` — the product as it should behave.
- **Open work**: `docs/TASKS.md` — task tracker grouped by area (Core / Frontend / Persistence / Backend / Packaging) with status (Done / Pending / Draft / Removed).
- **User TODO scratchpad**: `.ai/tasks.md`.
- **Tests + 61 invariants**: `tests/`.
- **Backend security model**: `server/src/security.ts` (Origin/Referer + rate limits) + `server/src/replay.ts` (server-side physics replay).

## When changing the game

1. Update the relevant module under `src/` (and `server/src/` if the server-side replay validator needs to mirror the change — physics/scoring/mapgen are shared so usually no extra work).
2. Run `npm test` and `npx tsc --noEmit` for the frontend; `cd server && npx tsc --noEmit` for the backend.
3. If user-facing: update README controls table and `docs/PRD.md`.
4. If the change introduces new tasks, append rows to the relevant area table in `docs/TASKS.md` with an appropriate Status.
