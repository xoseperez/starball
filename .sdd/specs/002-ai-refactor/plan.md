# Plan — 002-ai-refactor

Restructure the repo to match the four-layer layout in `spec.md`. No code under `src/`, `server/`, or `tests/` changes; this is purely a documentation + tooling reorganization.

## Target tree

```
starball/
├── AGENTS.md                     ← NEW: hub, six-section format
├── CLAUDE.md                     ← REWRITTEN: one-line pointer to AGENTS.md
├── README.md                     ← UPDATED: refresh doc links
├── .claude/                      ← NEW (selectively committed via .gitignore exceptions)
│   ├── settings.json             ← committed: shared perms/hooks (start empty/minimal)
│   ├── settings.local.json       ← gitignored: personal additionalDirectories
│   └── commands/
│       ├── specify.md            ← /specify slash command
│       ├── plan.md               ← /plan slash command
│       └── review.md             ← /review slash command
├── docs/                         ← REPURPOSED: steering only
│   ├── architecture.md           ← NEW: stable system overview
│   ├── conventions.md            ← NEW: code style with concrete examples
│   └── constitution.md           ← NEW: non-negotiables
├── specs/
│   ├── 001-initial-game/         ← NEW: retroactive feature folder
│   │   ├── prd.md                ← from docs/PRD.md
│   │   ├── tasks.md              ← from docs/TASKS.md
│   │   └── spec.md               ← from docs/PROMPT.md  (NOTE below)
│   └── 002-ai-refactor/
│       ├── spec.md               ← already exists
│       ├── plan.md               ← THIS FILE
│       └── review.md             ← TBD before execution
└── .gitignore                    ← UPDATED: add exceptions for .claude/
```

> NOTE on `specs.md` vs `spec.md`: the user instruction said "`specs.md`" but the convention from `spec.md` (lines 47–57) uses singular `spec.md`. Going with singular for layout consistency. Flag for confirmation before executing — if `specs.md` was intentional, swap the filename in step 4.3.

## Phase 1 — Scaffold `.claude/` and slash commands

1.1. Create `.claude/settings.json` with a minimal stub (e.g. `{}` or one shared permission). Avoid duplicating personal config that belongs in `settings.local.json`.

1.2. Create `.claude/settings.local.json` (will be gitignored; not committed).

1.3. Create `.claude/commands/{specify,plan,review}.md` slash commands aligned with the SpecKit phase model:
- `specify.md` — given a feature name, scaffold `specs/NNN-<slug>/spec.md` from a template.
- `plan.md` — given a feature folder, draft `plan.md` referencing the spec.
- `review.md` — given a feature folder, draft `review.md` (assumptions challenged, alternatives considered, risks accepted).

Templates can be terse; refine later.

## Phase 2 — `.gitignore` exceptions

Current rule blanket-ignores all dotfiles. Append targeted exceptions:

```
# Allow committed Claude Code tooling
!.claude/
!.claude/settings.json
!.claude/commands/
!.claude/commands/*

# Keep personal local settings out
.claude/settings.local.json
```

Do this *before* running `git add .claude/` or git won't see the files. `.resources/` and `.ai/` (if ever created) remain ignored under the blanket — fine.

## Phase 3 — New steering files under `docs/`

3.1. **`docs/architecture.md`** — stable system overview. Pull from current `CLAUDE.md` "Project" section + parts of `PRD.md` describing topology:
- single SPA + Hono backend, one container/one image
- shared physics modules (`src/`) imported by both client and server replay validator
- fixed 640×360 logical canvas, HUD/playfield split
- persistence split: localStorage (settings + offline cache) vs SQLite (shared scores)
- security model pointer to `server/src/security.ts` + `server/src/replay.ts`

3.2. **`docs/conventions.md`** — code style with examples. Pull from `CLAUDE.md` "Conventions" block:
- TypeScript ESM, `tsx` for server (no compile step)
- procedurally generated sprites, synthesized audio — no binary assets
- tests are pure logic; no DOM/canvas tests
- terse commits, zero comments unless WHY is non-obvious

3.3. **`docs/constitution.md`** — non-negotiables only:
- No PNG/audio binary assets
- DawnBringer 32 palette is fixed
- Server replay validator MUST mirror client physics (shared modules under `src/`)
- TypeScript ESM end-to-end; no transpile of server
- No emojis in code or commits unless explicitly asked
- Stack: Vite + Vitest + Hono + better-sqlite3 + tsx + Docker Compose

Each file should be short (constitution especially — bullet list, not prose).

## Phase 4 — Move files into `specs/001-initial-game/`

Use `git mv` to preserve history.

4.1. `git mv docs/PRD.md specs/001-initial-game/prd.md`
4.2. `git mv docs/TASKS.md specs/001-initial-game/tasks.md`
4.3. `git mv docs/PROMPT.md specs/001-initial-game/spec.md`  *(or `specs.md` if confirmed)*

Do **not** retroactively invent `plan.md` / `review.md` / `research.md` for 001 — leave the folder with just the three real artifacts.

## Phase 5 — `AGENTS.md` as the hub

Create `AGENTS.md` at the root following the six-section format from the GitHub analysis. Target ≤200 lines. Reuse existing `CLAUDE.md` content but reorganize:

1. **Commands** — npm scripts, docker compose, dev URLs (from current `CLAUDE.md` "Common commands").
2. **Testing** — `npm test` (61 vitest tests, pure logic), `npx tsc --noEmit` typecheck for both frontend and `server/`. Point at `tests/` for invariants.
3. **Project structure** — short tree (refreshed for new layout), link to `docs/architecture.md` for depth.
4. **Code style** — one-line summary, link to `docs/conventions.md`.
5. **Git workflow** — terse commits, no emojis, no `--no-verify`, prefer `git mv` for renames.
6. **Boundaries** — link to `docs/constitution.md`. Explicit "never do this" list (no binary assets, no diverging physics between client and server, etc.).

Also include a "Where to find what" pointer block:
- Active features → `specs/`
- Project-wide TODOs → `specs/001-initial-game/tasks.md` (or migrate to a top-level `TASKS.md` later if it outgrows the feature folder)
- Architecture / conventions / constitution → `docs/`

## Phase 6 — Slim `CLAUDE.md`

Replace the full contents with a single line:

```
See [AGENTS.md](./AGENTS.md).
```

Claude Code still reads `CLAUDE.md` natively; the pointer keeps the hub canonical without duplication.

## Phase 7 — Update cross-references

7.1. **`README.md`** — grep for `docs/PRD.md`, `docs/TASKS.md`, `docs/PROMPT.md`, `.ai/tasks.md`. Repoint each to the new location (or to `AGENTS.md` if it's a generic "see project docs" link).

7.2. **The global `CLAUDE.md`** at `/home/xose/.claude/CLAUDE.md` is outside this repo and not in scope; leave it alone.

7.3. Drop the dangling `.ai/tasks.md` reference (the directory doesn't exist). If a personal scratchpad is wanted later, create `.resources/` instead — the spec recommends one name, not both.

## Sequencing

Run phases in order. Each phase leaves the tree in a working state:

1. Phase 2 (`.gitignore` exceptions) before Phase 1's writes get staged, otherwise git won't see `.claude/`.
2. Phases 1, 3 — additive, safe in any order after Phase 2.
3. Phase 4 — moves; do after the new `AGENTS.md` exists (Phase 5) so the hub references don't briefly break, *or* land them in the same commit.
4. Phase 5, 6, 7 — finishing touches; commit together with Phase 4.

A clean three-commit split:
- Commit A: tooling scaffold (`.gitignore`, `.claude/`).
- Commit B: new steering docs (`docs/architecture.md`, `docs/conventions.md`, `docs/constitution.md`, `AGENTS.md`, `CLAUDE.md` stub).
- Commit C: feature 001 moves + README link refresh.

## Verification checklist

- [ ] `git log --follow specs/001-initial-game/prd.md` shows history back to the original PRD.md
- [ ] `git status` clean; `.claude/settings.json` and `.claude/commands/*` are tracked, `.claude/settings.local.json` is not
- [ ] `grep -r 'docs/PRD\|docs/TASKS\|docs/PROMPT\|\.ai/tasks' .` returns no hits outside this plan and `specs/`
- [ ] `AGENTS.md` is under ~200 lines and has all six sections
- [ ] `npm test` still passes (no code changed, but sanity check)
- [ ] `npx tsc --noEmit` (frontend) and `cd server && npx tsc --noEmit` (backend) still pass

## Open questions

1. **`spec.md` vs `specs.md`** for the PROMPT.md destination (filename consistency).
2. **Top-level `TASKS.md`?** `specs/001-initial-game/tasks.md` is the literal instruction, but the current `docs/TASKS.md` is area-grouped (Core/Frontend/Persistence/Backend/Packaging) and project-wide rather than feature-scoped. Acceptable now; revisit if it starts collecting tasks that obviously don't belong to "the initial game" feature.
3. **`docs/PROMPT.md` contents** — unread so far; if it's a one-off prompt log it may belong in a `.resources/` scratchpad rather than the spec folder. Worth a 30-second read before executing Phase 4.3.
