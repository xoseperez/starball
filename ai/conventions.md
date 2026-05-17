# Conventions

How code is written in this repo. Stable across features.

## Language and runtime

- **TypeScript ESM** end-to-end. No CommonJS.
- Frontend: Vite + Vitest. `npm run build` emits a static bundle to `./dist`.
- Backend: `tsx` runs server modules directly — no `tsc` compile step in production. Type-check via `npx tsc --noEmit` in `server/`.

## Shared modules

`physics`, `scoring`, and `mapgen` under `src/` are imported by both the client and the server's replay validator. Changes to any of them must keep both paths working — when in doubt, run the full test suite which exercises invariants pure-logic.

## Rendering and assets

- Single fixed logical canvas 640 × 360. No PNG / JPG / GIF assets ship — sprites are procedurally generated to `HTMLCanvasElement` at first use in `src/sprites.ts`.
- Palette: **DawnBringer 32**, declared in `src/config.ts`. Never inline hex colors outside that file; reference the named palette entries.

## Audio

- Synthesized via the Web Audio API. No `.wav` / `.mp3` / `.ogg` files in the repo.

## Tests

- All under `tests/`, run with `npm test` (Vitest).
- Pure logic only — physics, scoring, mapgen, input, persistence. **No DOM tests, no canvas tests.** If a behavior cannot be tested as a pure function, restructure until it can.
- Treat the existing invariants as load-bearing — they're how we know client and server replay stay in sync.

## Commits

- Terse subject lines, present-tense imperative ("Add foo", not "Added foo" or "Adds foo").
- No emojis in commit messages or code unless explicitly requested.
- Default to zero comments. Add one only when the **why** is non-obvious (a hidden constraint, a subtle invariant, a workaround for a specific bug). Never explain *what* the code does — names already do that.
- Prefer `git mv` for renames so history is preserved.

## When changing the game

1. Update the relevant module under `src/` (and `server/src/` only if the replay validator needs to mirror the change — shared modules usually mean no extra work).
2. Run `npm test` and `npx tsc --noEmit` (frontend) and `cd server && npx tsc --noEmit` (backend).
3. If user-facing: update `README.md` controls table and `specs/001-initial-game/prd.md`.
4. If new tasks emerge, append rows to the relevant area table in `specs/001-initial-game/tasks.md` with an appropriate Status.

## See also

- `architecture.md` — how the system fits together
- `constitution.md` — non-negotiables
