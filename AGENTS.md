# Starball — agent hub

<!-- sdd:base=.sdd -->

You are working on Starball, a TypeScript browser game (gravity-puzzle / Pocket-Tanks-style) that also ships a Node + SQLite backend for shared high scores. SPA and API are served from the same container; the server's replay validator imports the same physics/scoring modules the client runs.

Start here. Deep references live under `.sdd/`.

## 1. Commands

```sh
# Frontend (Vite + Vitest)
npm install
npm run dev          # vite dev server on http://localhost:5173 (proxies /api → :3000)
npm test             # vitest run — pure-logic suites
npm run build        # static bundle in ./dist
npm run preview      # serve the built bundle locally
npx tsc --noEmit     # type-check the frontend

# Backend (Hono + better-sqlite3, run via tsx — no compile step)
cd server
npm install
npm run dev          # tsx watch on http://localhost:3000
npm run typecheck    # npx tsc --noEmit

# Full stack via Docker
docker compose up -d --build       # http://localhost:8080
docker compose down                # stop, keep volume (high scores persist)
docker compose down -v             # stop and wipe scores
```

The Vite dev server proxies `/api/*` to `localhost:3000`, so running both dev servers gives a fully wired local stack without Docker.

## 2. Testing

- `npm test` runs the Vitest suites under `tests/`.
- All tests are **pure logic** — physics, scoring, mapgen, input, persistence. No DOM/canvas tests; if a behavior can't be tested as a pure function, restructure it.
- Replay-validation invariants are load-bearing — they're how we know client and server stay in sync. Don't weaken them to make a feature land.
- Type-check both halves before declaring done: `npx tsc --noEmit` at the root, and again under `server/`.

## 3. Project structure

```
starball/
├── AGENTS.md             ← you are here (hub)
├── CLAUDE.md             ← pointer to this file
├── README.md             ← public-facing
├── .claude/              ← shared permissions (settings.local.json is ignored)
├── .sdd/                 ← all AI-harness material
│   ├── architecture.md   ← stable steering
│   ├── conventions.md
│   ├── constitution.md
│   └── specs/            ← per-feature folders (spec.md / plan.md / review-request.md / review-response.md / tasks.md)
│       ├── 001-initial-game/
│       └── 002-…
├── src/                  ← frontend + shared physics/scoring/mapgen modules
├── server/               ← Hono API + replay validator (imports from ../src/)
├── tests/                ← Vitest suites (pure logic)
├── Dockerfile, docker-compose.yml
└── package.json, vite.config.ts, tsconfig.json, vitest.config.ts
```

See `.sdd/architecture.md` for the topology and the SPA/API boundary in more detail.

## 4. Code style

- **TypeScript ESM** throughout. `tsx` runs server modules directly — no separate compile step.
- Fixed logical canvas **640 × 360** (40 px HUD + 320 px playfield). Integer-factor scaling only.
- **DawnBringer 32** palette only, declared in `src/config.ts`. No inline hex colors elsewhere.
- **No binary assets.** Sprites are procedurally generated to canvas (`src/sprites.ts`); audio is synthesized via Web Audio.
- Persistence split: `localStorage` (settings + offline cache, versioned schemas), SQLite volume (shared scores).
- Default to **zero comments**. Add one only when the WHY is non-obvious.
- Shared modules under `src/` (physics, scoring, mapgen) are imported by *both* client and server — don't fork them.

Full details: `.sdd/conventions.md`.

## 5. Git workflow

- Terse, present-tense imperative commit subjects ("Add foo", not "Added foo").
- **No emojis** in code, commits, or generated docs unless the user asks.
- **No `--no-verify` commits.** If a hook fails, fix the cause.
- **No force-push to `master`.**
- Prefer `git mv` over delete+create for renames (preserves history).
- One commit per logical change; let pre-commit hooks run.

## 6. Boundaries

Hard rules from `.sdd/constitution.md`. Bending any of these requires an explicit decision in a feature's `review-response.md`:

- The server's replay validator MUST run the same physics/scoring/mapgen code as the client. Don't fork shared modules.
- No PNG/JPG/WAV/MP3/TTF in the repo. Procedural sprites + synthesized audio only.
- DawnBringer 32 is the only palette.
- TypeScript ESM end-to-end. No CommonJS, no JS-only modules.
- Tests are pure-logic. No DOM or canvas rendering tests.
- The project does not ship: mobile/touch input, accounts/OAuth, telemetry, online multiplayer, replay playback, level editor, i18n.

## Where to find what

- **What the game is** → `.sdd/specs/001-initial-game/prd.md`
- **Open task list** → `.sdd/specs/001-initial-game/tasks.md`
- **Active feature work** → `.sdd/specs/NNN-…/` folders
- **System topology** → `.sdd/architecture.md`
- **Coding standards** → `.sdd/conventions.md`
- **Non-negotiables** → `.sdd/constitution.md`
- **Backend anti-cheat** → `server/src/security.ts` + `server/src/replay.ts`
- **Test invariants** → `tests/`

## Workflow for a new feature

1. `/sdd:specify <slug>` → creates `.sdd/specs/NNN-<slug>/spec.md`, fills it interactively.
2. `/sdd:plan NNN-<slug>` → drafts `plan.md` after reading the spec and grounding in code.
3. `/sdd:check NNN-<slug>` → runs a soft readiness audit of requirement coverage and verification evidence before requesting review.
4. `/sdd:review-request NNN-<slug>` → drafts `review-request.md`: a prompt for an **independent third-party agent** to read the spec/plan/constitution and produce `review-response.md`. **Human gate before code is written.**
5. Back in the original session, process `review-response.md`: update `spec.md` / `plan.md` / `tasks.md` as needed, then implement; track progress in `.sdd/specs/NNN-<slug>/tasks.md`.
