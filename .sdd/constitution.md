# Constitution

Non-negotiable rules. Violating any of these requires an explicit, documented decision in a feature's `review.md` — not a quiet workaround.

## Stack

- **TypeScript ESM** end-to-end. No CommonJS, no JavaScript-only modules.
- **Vite** for the SPA build. **Vitest** for tests.
- **Hono** for the backend, **better-sqlite3** for persistence, **`tsx`** for execution (no transpile step on the server).
- **Docker Compose** is the only supported deployment recipe. One image, one container.

## Assets

- **No binary assets in the repo.** No PNG / JPG / GIF / WAV / MP3 / OGG / TTF.
- Sprites are procedurally generated to canvas. Audio is synthesized via Web Audio.
- **DawnBringer 32** is the only palette. All colors come from `src/config.ts`.

## Game canvas

- Logical canvas is fixed at **640 × 360** (40 px HUD + 320 px playfield). Scaling is integer-factor only.

## Physics integrity

- The server's replay validator MUST run the **same** physics, scoring, and mapgen code as the client. The shared modules under `src/` exist for this reason — do not fork them.
- Any change to physics, scoring, or mapgen must keep client and server agreement; the invariant tests in `tests/` are the gate.

## Tests

- Pure-logic only. No DOM tests, no canvas rendering tests.
- Replay-validation invariants are load-bearing. Do not delete or weaken them to make a feature land.

## Process

- **No emojis** in code, commits, or generated docs unless the user asks for them.
- **No `--no-verify` commits.** If a hook fails, fix the cause.
- **No force-push to `master`.**
- Prefer `git mv` over delete+create for file moves.

## Scope

The project intentionally does **not** ship:

- Mobile / touch input
- Server-side user accounts, OAuth, telemetry, or ads
- Online multiplayer
- Replay playback (server re-runs physics for validation only; clients don't visualize others' runs)
- Level editor
- i18n / localization

Adding any of these requires a feature spec that justifies the scope expansion, not a drive-by change.
