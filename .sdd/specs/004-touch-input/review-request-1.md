# Review request — 004-touch-input (touch-screen support for tablets)

You are an independent reviewer. You have filesystem access to this repo but no prior context on this feature. The user is about to act on the implementation plan in `.sdd/specs/004-touch-input/plan.md` — your job is to surface anything that should give them pause **before code is written**.

A review that says "looks good" is useless. Be honest, specific, and uncomfortable when needed.

## What to read first

1. `.sdd/specs/004-touch-input/spec.md` — what the user wants and why.
2. `.sdd/specs/004-touch-input/plan.md` — the proposed implementation and requirement coverage mapping.
3. `.sdd/constitution.md` — the project's non-negotiables. The relevant rules for this feature are:
   - **Scope**: "Mobile / touch input" is on the does-not-ship list (`.sdd/constitution.md:43`). This feature lifts it. The constitution says the decision must be documented in a feature's `review.md` (`.sdd/constitution.md:3`), while `AGENTS.md` § 6 calls the file `review-response.md`. Treat your `review-response.md` as that record, and say whether the bend is justified.
   - **Physics integrity**: the server's replay validator must run the same physics, scoring and mapgen code as the client; the shared modules must not fork.
   - **Assets**: no binary assets; sprites procedural; DawnBringer 32 only, all colors from `src/config.ts`.
   - **Game canvas**: 640 × 360 logical, "scaling is integer-factor only" (`.sdd/constitution.md:20`). The code no longer does this; see the `src/app.ts` pointers below.
   - **Tests**: pure logic only, no DOM or canvas tests; replay invariants are load-bearing.
   - **Stack**: TypeScript ESM, Vite, Vitest.
   - **Process**: no emojis in code or docs.
4. Then the load-bearing code:
   - `src/scenes/base.ts:4` — `InputEvent { key, shift }`, the single input entry point. The plan reuses it for touch, adding only a `focus(index)` hook, instead of moving to named actions.
   - `src/app.ts:15` — `KEYS_THAT_BLOCK_DEFAULT` leaves out `Escape`. The spec's problem (Esc minimizes the browser on Android) and the plan's fix (`preventDefault` on Esc on touch devices) both depend on this.
   - `src/app.ts:69` and `src/app.ts:95` — `resize()`/`render()` stretch 640 × 360 over the whole window on both axes, at native DPR. The plan lifts this into `renderTransform()` and inverts it for touch mapping. It contradicts the integer-scaling rule in `.sdd/constitution.md:20` and `.sdd/architecture.md:40`.
   - `src/app.ts:111` and `src/app.ts:131` — `installInput()`: today's only touch handling is an audio unlock on `pointerdown`/`touchstart`.
   - Scene `handleEvent` bodies, which the plan's `REQUIRED_ACTIONS` table must transcribe exactly. Check the transcription in the plan against these:
     - `src/scenes/menu.ts:27`
     - `src/scenes/settings.ts:56`
     - `src/scenes/highscores.ts:43`
     - `src/scenes/help.ts:53`
     - `src/scenes/initials.ts:49`
     - `src/scenes/play.ts:68`
     - `src/scenes/battle.ts:76`
     - `src/scenes/sandbox.ts:42`
   - `src/scenes/play.ts:17`, `src/scenes/battle.ts:17`, `src/scenes/sandbox.ts:15` — the phase enums the gameplay layouts are keyed on. `src/scenes/play.ts:156` (`advanceOrGameOver`) decides between Initials entry and `GAME_OVER`, and matters for when BACK needs confirmation.
   - `src/scenes/settings.ts:85` and `src/scenes/settings.ts:92` — rows are 24 px apart. The plan re-spaces them to 28 px in touch mode to meet the size and gap rule.
   - `src/scenes/initials.ts:151` — letter positions come from `measureText`. The plan replaces them with fixed 44 px cells in touch mode, because pure layouts cannot measure text.
   - `src/scenes/menu.ts:60` and `src/scenes/menu.ts:66` — menu item positions the touch hit areas must match.
   - `src/scenes/help.ts:48` — `PAGE_COUNT = 2`. There is no controls page today, but the spec assumes one exists. The plan adds a third page on touch devices only.
   - `src/render.ts:195`, `src/scenes/battle.ts:241`, `src/scenes/sandbox.ts:156` — the current HUD contents. The plan claims every readout still fits in the 40 px band next to the touch buttons. Battle is the tightest case: the player boxes are narrowed from 130 to 116 px.
   - `src/render.ts:44` — `drawText` gets an optional `maxWidth`, the plan's guard against text overlapping controls.
   - `src/scenes/play.ts:368`, `src/scenes/play.ts:374`, `src/scenes/battle.ts:369` — overlay hints replaced by CONTINUE / MENU buttons.
   - `src/input.ts` — `AimState`, the only thing touch aiming changes. `src/config.ts:257` holds the step settings (`angle_step_deg`, `power_step_pct`, `shift_multiplier`) that set fine and coarse steps.
   - `server/src/replay.ts:137` — the validator accepts any finite angle and any power in [10, 100], which the spec relies on for "no server change".
   - `src/mapgen.ts:131` and `src/mapgen.ts:133` — launcher in the left third, goal in the right third, at any height. This is why the controls go in the HUD band rather than corner overlays.
   - `index.html:5` and `index.html:7` — viewport meta and page CSS, where the plan adds the gesture-suppression CSS.
   - `tsconfig.json:6` and `vitest.config.ts:6` — DOM types are compiled everywhere and tests run under `node`. The "pure modules have no DOM types" rule (RQ-016) is therefore enforced by a source scan, not by the compiler. Judge whether that is credible.
   - `.sdd/specs/003-wasm/spec.md` — the pending Rust/WASM rewrite, which must port this design. It was edited during this feature's spec to include touch in its parity scope. Check that the two specs agree.
   - `AGENTS.md:95` and `.sdd/specs/001-initial-game/prd.md` (lines 11, 57, 196, 203) — docs that still say keyboard-only or no touch.

Context you cannot get from the files:
- Target devices are an Android tablet with Chrome and an iPad with Safari.
- The user reports that pressing Esc on their tablet's keyboard minimizes the browser.
- The user explicitly requires that no touch buttons or options ever appear in a PC browser, including PCs with touchscreens.
- The user chose: buttons only (no drag-to-aim), all gameplay controls in the HUD band, the TypeScript game first and the Rust port after, and a fullscreen toggle on the main menu.

## Produce `.sdd/specs/004-touch-input/review-response.md`

The file should contain these sections, in this order:

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
- Browser behavior claims (history-entry skipping, Esc handling on Android, `pointer`/`hover` media features on iPadOS, Fullscreen API support on iPad Safari) can't be checked from this repo. Mark each such claim as verified (cite a source), plausible, or doubtful, and say which ones the plan's device spike must settle.

## At the end of `review-response.md`

Surface **the single most important risk or open question** before listing the recommendation. Don't bury the lede. If the plan is genuinely solid, say so plainly — *and* call out the most important risk anyway. There is always one.
