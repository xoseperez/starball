# Review request — 004-touch-input (touch-screen support for tablets), round 2

You are an independent reviewer. You have filesystem access to this repo but no prior context on this feature. The user is about to act on the implementation plan in `.sdd/specs/004-touch-input/plan.md` — your job is to surface anything that should give them pause **before code is written**.

A review that says "looks good" is useless. Be honest, specific, and uncomfortable when needed.

This is the second review. The first one (`review-response-1.md`) recommended **Reject — needs replan**. The planner then changed `spec.md`, `plan.md` and `tasks.md` and logged each resolution in `plan.md` § Review follow-up. Do two things:
1. For each first-round point, check that the change addresses it in substance, not just in wording. Say *resolved*, *partially resolved* or *not resolved*, with evidence.
2. Review the current spec and plan from scratch as well. Changes made to answer round 1 can introduce new problems, for example the Phase 0 gate, the scene tests under Node, or the redefined PC rule.

## What to read first

1. `.sdd/specs/004-touch-input/spec.md` — what the user wants and why.
2. `.sdd/specs/004-touch-input/plan.md` — the proposed implementation and requirement coverage mapping. Read § Review follow-up last.
3. `.sdd/specs/004-touch-input/review-response-1.md` — the first review. `review-request-1.md` is the brief that produced it.
4. `.sdd/specs/004-touch-input/tasks.md` — the task list, now starting with the Phase 0 browser gate.
5. `.sdd/constitution.md` — the project's non-negotiables. The relevant rules for this feature are:
   - **Scope**: "Mobile / touch input" is on the does-not-ship list (`.sdd/constitution.md:43`). This feature lifts it. Round 1 recorded the bend as justified. Confirm or challenge that. The constitution names the record `review.md` (`.sdd/constitution.md:3`), while `AGENTS.md` § 6 says `review-response.md`; this repo uses the latter.
   - **Game canvas**: "Scaling is integer-factor only" (`.sdd/constitution.md:20`). The user has now decided the window-filling stretch in `src/app.ts` is the rule, and the plan rewrites this line in Phase 7. Judge whether that is a properly recorded bend and whether anything else still depends on integer scaling.
   - **Physics integrity**: the server's replay validator must run the same physics, scoring and mapgen code as the client; the shared modules must not fork.
   - **Assets**: no binary assets; sprites procedural; DawnBringer 32 only, all colors from `src/config.ts`.
   - **Tests**: pure logic only, no DOM or canvas tests; replay invariants are load-bearing. The plan now drives real scene objects under Node in `tests/touch-scenes.test.ts`. Decide whether that stays within the rule.
   - **Stack**: TypeScript ESM, Vite, Vitest.
   - **Process**: no emojis in code or docs.
6. Then the load-bearing code:
   - `src/scenes/base.ts:4` — `InputEvent { key, shift }`, the single input entry point that touch reuses (plus a `focus(index)` hook).
   - `src/app.ts:15` — `KEYS_THAT_BLOCK_DEFAULT` leaves out `Escape`. The Esc problem on Android and the plan's `preventDefault` fix both depend on this.
   - `src/app.ts:69` and `src/app.ts:95` — `resize()`/`render()`: the stretch over the whole window at native DPR, which becomes `renderTransform()` and is inverted for touch mapping.
   - `src/app.ts:111` and `src/app.ts:131` — `installInput()`; today's only touch handling is an audio unlock.
   - `src/scenes/menu.ts:88` — scene changes finish after a dynamic `import()`. The plan pushes history guard entries "right after a scene change", and Phase 0 checks whether browsers still treat that as user-initiated.
   - Scene `handleEvent` bodies, which `REQUIRED_ACTIONS` must transcribe exactly and which the scene tests drive:
     - `src/scenes/menu.ts:27`
     - `src/scenes/settings.ts:56`
     - `src/scenes/highscores.ts:43`
     - `src/scenes/help.ts:53`
     - `src/scenes/initials.ts:49`
     - `src/scenes/play.ts:68`
     - `src/scenes/battle.ts:76`
     - `src/scenes/sandbox.ts:42`
   - `src/scenes/play.ts:17`, `src/scenes/battle.ts:17`, `src/scenes/sandbox.ts:15` — the phase enums the layouts and `backConfirmRule()` are keyed on. `src/scenes/play.ts:156` decides between Initials entry and `GAME_OVER`.
   - What scenes pull in when imported under Node, which decides whether `tests/touch-scenes.test.ts` is feasible:
     - `src/sprites.ts:13` and `src/render.ts:280` — `document.createElement` inside functions;
     - `src/audio.ts:32` — `AudioContext` looked up lazily on `globalThis`;
     - `src/persistence.ts:72` — `localStorage` with an in-memory fallback;
     - `src/settings_store.ts:36` — the `SETTINGS` singleton;
     - `src/scenes/initials.ts:1` and `src/scenes/highscores.ts:1` — `api.ts`, which uses `fetch` (`src/api.ts:32`).
   - `src/scenes/settings.ts:85` and `src/scenes/settings.ts:92` — 24 px row spacing, re-spaced to 28 px in touch mode.
   - `src/scenes/initials.ts:151` — letter positions measured with `measureText`, replaced by fixed cells in touch mode.
   - `src/scenes/menu.ts:60` and `src/scenes/menu.ts:66` — menu item positions the hit areas must match.
   - `src/scenes/help.ts:48` — `PAGE_COUNT = 2`; the plan adds a third page on touch devices only.
   - `src/render.ts:44`, `src/render.ts:195`, `src/scenes/battle.ts:241`, `src/scenes/sandbox.ts:156` — `drawText` (gains `maxWidth`) and the current HUD contents that must fit beside the touch buttons. Battle is the tightest.
   - `src/scenes/play.ts:368`, `src/scenes/play.ts:374`, `src/scenes/battle.ts:369` — overlay hints replaced by CONTINUE / MENU buttons.
   - `src/input.ts` and `src/config.ts:257` — `AimState` and the step settings behind fine and coarse steps.
   - `server/src/replay.ts:137` — the validator accepts any finite angle and any power in [10, 100], which "no server change" relies on.
   - `src/mapgen.ts:131` and `src/mapgen.ts:133` — launcher and goal placement, the reason controls live in the HUD band.
   - `index.html:5` and `index.html:7` — viewport meta and page CSS (gesture suppression goes here).
   - `tsconfig.json:6` and `vitest.config.ts:6` — DOM types compiled everywhere; tests run under `node`.
   - `.sdd/specs/003-wasm/spec.md` (lines 14, 22, 30, 52, 61, 69, 70) — the pending Rust/WASM rewrite that ports this design. It was edited to include touch and the stretch scaling. Check that the two specs agree.
   - `AGENTS.md:68`, `AGENTS.md:95`, `.sdd/architecture.md:40` and `.sdd/specs/001-initial-game/prd.md` (lines 11, 57, 196, 203) — docs that still say integer scaling, keyboard-only or no touch. Phase 7 updates them.

Context you cannot get from the files:
- Target devices are an Android tablet with Chrome and an iPad with Safari.
- The user reports that pressing Esc on their tablet's keyboard minimizes the browser.
- The user requires that touch buttons and options never appear in a PC browser. After round 1, the user defined this as "never when the main pointer is a mouse or trackpad".
- After round 1, the user also decided that stretching to fill the window is the scaling rule, and said no touchscreen PC is available for testing.
- Earlier choices: buttons only (no drag-to-aim), all gameplay controls in the HUD band, the TypeScript game first and the Rust port after, and a fullscreen toggle on the main menu.

## Produce `.sdd/specs/004-touch-input/review-response.md`

The file should contain these sections, in this order:

### `## Round 1 follow-up`
One row per point in `review-response-1.md` (its Recommendation, Required updates, Constitution check, and every weak or uncovered requirement ID): the point, what changed, and a verdict — *resolved* / *partially resolved* / *not resolved* — with file and line evidence.

### `## Assumptions challenged`
The load-bearing assumptions in `plan.md`. For each: the assumption (one line), evidence for or against (specific file paths, behaviors, prior incidents), and a verdict — *holds* / *partially holds* / *fails*. If you can't find evidence either way, say so — known unknowns matter.

### `## Alternatives considered`
At least two genuine alternative approaches and why the chosen plan beats them. If there really is no meaningful alternative, write "no meaningful alternative" with a one-sentence reason. Do not pad with strawmen.

### `## Risks accepted`
What can go wrong and why we're accepting it. Tie each risk to a specific section of the plan. Order by likelihood × impact, highest first.

### `## Constitution check`
For each relevant rule in `.sdd/constitution.md`, note whether the plan: *complies*, *knowingly bends it* (with justification), or *accidentally violates it* (which means replan).

### `## Verification gaps`
Anything in `plan.md`'s "Verification" section that won't actually prove the feature works. E.g. "passes tests" is not verification if no tests exercise the new path.

### `## Requirements contract coverage`
Evaluate the `Requirements contract` in `spec.md` against `Requirement coverage plan` in `plan.md`:
- Which requirement IDs are fully covered with credible evidence paths
- Which IDs are weakly covered (evidence too vague, method not credible, or implementation mapping unclear)
- Which IDs are not covered at all
- Whether non-test verification choices are appropriate for this feature context

Call out every uncovered or weak requirement ID explicitly.

### `## Recommendation`
One of:
- **Approve as-is**
- **Approve with edits** — list them
- **Reject — needs replan** — explain what's wrong

### `## Required updates for planner artifacts`
List exact edits the original planning agent should make before implementation:
- `spec.md` updates (if any)
- `plan.md` updates (if any)
- `tasks.md` updates (if any)

If no updates are needed for one file, write `none` explicitly.

## Ground rules

- Be specific. "The auth assumption is wrong" is useless; "plan.md §2 assumes session tokens are signed, but `auth.ts:42` only HMACs the user ID" is the goal.
- Don't invent problems to look thorough. Don't paper over real ones to look agreeable.
- If the spec or plan itself is the problem (not the implementation tactic), say so and recommend *Reject — needs replan*.
- Cite file paths and line numbers wherever you can. The user should be able to verify every claim in under a minute.
- Do not require automated tests when they are not feasible in context; require credible, inspectable evidence instead.
- Some claims about browser behavior can't be checked from this repo: history-entry skipping, how Esc reaches the page on Android, `pointer`/`hover` media features on iPadOS, and Fullscreen API support on iPad Safari. Mark each one verified (cite a source), plausible or doubtful. Then check that the Phase 0 gate actually tests it, and that its pass/fail rule is decisive.
- Do not edit `spec.md`, `plan.md`, `tasks.md` or the round-1 files. Your only output is `review-response.md`.

## At the end of `review-response.md`

Surface **the single most important risk or open question** before listing the recommendation. Don't bury the lede. If the plan is genuinely solid, say so plainly — *and* call out the most important risk anyway. There is always one.
