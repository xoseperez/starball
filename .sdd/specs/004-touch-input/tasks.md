# Tasks — 004-touch-input

Derived from `plan.md`. Check items off as you complete them. Add new items as the work surfaces them — the plan is a forecast; reality wins.

## Phase 0 — Browser gate (before any implementation)
- [ ] Build the throwaway guard page in the job scratch directory (same-URL pushes topped up on every tap and key, delayed transition, unwind on "menu", on-screen event log). Never commit it
- [ ] Serve it with `npx vite <scratch-dir> --host` and open it on Android Chrome and iPad Safari
- [ ] Run the RQ-005 sequences on both browsers: single Back; double Back within 3 s; Back, wait over 3 s, Back, Back; Back right after a delayed transition without touching; Back after a reload; Esc with and without `preventDefault()`; iPad edge swipe. Per sequence record browser and version, starting state (guard depth, delayed transition), events in order, and the result (page stayed or left, state reached)
- [ ] Record `(pointer: coarse)`, `(hover: none)`, `(any-pointer: fine)`, `(any-hover: hover)` with browser and version on: each tablet touch-first, without and with its keyboard; the iPad with a Bluetooth mouse or trackpad (if at hand); PC Chrome and Firefox
- [ ] Record Fullscreen API availability and actual enter/exit on iPad Safari; "unsupported" recorded separately from "supported but failed"
- [ ] Check that every scene imports and constructs under Vitest's node environment with the Phase 3 isolation rules
- [ ] Decision: continue only if (1) every RQ-005 sequence keeps the page on both browsers and (2) both tablets, touch-first with and without keyboard, report `(pointer: coarse)` and `(hover: none)`. Then set `BACK_GUARD_DEPTH` and the arming rules from the results. If either fails, stop and bring the results to the user

## Phase 1 — Pure touch core
- [ ] Add touch constants to `src/config.ts` (sizes, gaps, repeat timings, back timings, guard depth from Phase 0, `MONO_ADVANCE`, control color aliases)
- [ ] `src/touch/geometry.ts`: `Rect` helpers, `renderTransform()`, `screenToLogical()`
- [ ] `src/touch/device.ts`: `isTouchDevice()`, `isPortrait()`
- [ ] `src/touch/mode.ts`: `TouchMode` and `TOUCH` singleton (`active` implies `device`)
- [ ] `src/touch/controls.ts`: `Control`, `TouchCommand`, `Readout`, `TouchLayout`, `TouchContext`, `BACK_RECT`, `EMPTY_LAYOUT`
- [ ] `src/touch/repeat.ts`: `HoldRepeat`
- [ ] `src/touch/pointers.ts`: `PointerTracker`
- [ ] `src/touch/dispatch.ts`: `dispatch()`
- [ ] `src/touch/back.ts`: `backConfirmRule()`, `BackConfirm`, `BackGuard`
- [ ] `tests/touch.test.ts`: geometry round trip, device classification, mode switch, repeat scheduler with `coarse` flags, pointer tracker, dispatch, back confirm, back guard with the Phase 0 sequences as cases, `backConfirmRule()` per scene and phase

## Phase 2 — Layouts and the coverage table
- [ ] `src/touch/layouts.ts`: `menuLayout`, `settingsLayout`, `highscoresLayout`, `helpLayout`, `initialsLayout`
- [ ] `src/touch/layouts.ts`: `gameplayLayout(mode, phase, extras)` for the HUD band and overlays
- [ ] `src/touch/keymap.ts`: `REQUIRED_ACTIONS`, transcribed from every scene's `handleEvent`
- [ ] Handler audit: compare `REQUIRED_ACTIONS` with every `handleEvent` line by line; record it in `touch-checklist.md`
- [ ] Tests: coverage of `REQUIRED_ACTIONS`, hit-testing sample points
- [ ] Tests: minimum size and gaps over every layout state, HUD-band containment, readout overlap and capacity, ABORT clear of FIRE
- [ ] Tests: source check of the pure files for browser names (including `globalThis`), resolving every static and dynamic import and walking the full closure

## Phase 3 — Scene hooks and touch-mode drawing
- [ ] `src/scenes/base.ts`: `isRoot`, `touchLayout()`, `focus()`, `backNeedsConfirm()`
- [ ] `src/touch/draw.ts`: `drawControls()` with procedural icons, `drawReadouts()`, `drawRotatePrompt()`
- [ ] `src/render.ts`: `maxWidth` option on `drawText`
- [ ] `menu.ts`: `isRoot`, `focus()`, `touchLayout()`, footer hidden in touch mode
- [ ] `settings.ts`: `focus()`, `touchLayout()`, 28 px row spacing and ◀ ▶ on every row in touch mode, footer hidden
- [ ] `highscores.ts`: `touchLayout()`, difficulty without `< >` in touch mode, footer hidden
- [ ] `help.ts`: `touchLayout()`, footer hidden (controls page comes in Phase 6)
- [ ] `initials.ts`: `focus()`, `backNeedsConfirm()` via `backConfirmRule()`, fixed letter cells and OK/EDIT in touch mode
- [ ] `play.ts`: `touchLayout()`, `backNeedsConfirm()` via `backConfirmRule()`, touch HUD from readouts, overlay hints hidden
- [ ] `battle.ts`: `touchLayout()`, `backNeedsConfirm()` via `backConfirmRule()`, touch HUD with 116 px player boxes, match-end hint hidden
- [ ] `sandbox.ts`: `touchLayout()`, touch HUD with lit PREVIEW / FIELD
- [ ] `tests/touch-scenes.test.ts` isolation: mock `src/api.ts`, `resetStoreForTests()` + `SETTINGS.load()` per test, assert no `AudioContext`, no `render()`, fixed seeds for Play/Battle and stubbed `Math.random` for Training, `vi.waitFor` for scene changes, explicit `dt`
- [ ] `tests/touch-scenes.test.ts`: key vs touch equivalence per scene, fine and coarse deltas in Play, Battle and Training, scene confirmation hooks against `backConfirmRule()`
- [ ] Any scene that cannot follow the isolation rules: move its key-to-state logic into a pure function and test that directly

## Phase 4 — DOM wiring, aiming and menus on the device
- [ ] `src/touch/dom.ts`: media queries and change listeners, pointer events with capture, visibility and blur cancel
- [ ] `src/touch/dom.ts`: `contextmenu` and `gesturestart` suppression on touch devices
- [ ] `src/app.ts`: `renderTransform()`, tracker steps in `tick()`, `drawControls()` in `render()`, `TOUCH.onKey()` in `keydown`
- [ ] `src/app.ts`: rotate prompt and input drop on touch devices in portrait
- [ ] `index.html`: gesture-suppression CSS
- [ ] Device pass on Android Chrome and iPad Safari: menus, aiming, hold and coarse steps, multi-touch, gestures, HUD fit and legibility

## Phase 5 — Back navigation
- [ ] Wire BACK, Esc on touch devices and `popstate` through `BackConfirm` / `BackGuard` with the Phase 0 depth and arming rules; QUIT? label
- [ ] Device pass: the RQ-005 sequences from every scene on both tablets, and one row per confirmation rule

## Phase 6 — Fullscreen and the Help controls page
- [ ] Fullscreen toggle in `menuLayout` and `dom.ts`, state from `fullscreenchange` / `webkitfullscreenchange`
- [ ] Help page 3 (CONTROLS) on touch devices only

## Phase 7 — Docs
- [ ] `.sdd/constitution.md` Scope: remove "Mobile / touch input"
- [ ] `.sdd/constitution.md:20` Game canvas: replace integer-factor scaling with the stretch rule
- [ ] `.sdd/architecture.md:40`: describe the stretch at native DPR
- [ ] `AGENTS.md`: § 6 remove "mobile/touch input"; § 4 (line 68) replace integer-factor scaling with the stretch rule
- [ ] `README.md`: Touch column in the controls table
- [ ] `.sdd/specs/001-initial-game/prd.md`: lines 11, 196, 203 and § 4.1 Controls
- [ ] `.sdd/conventions.md`: add "touch" to the pure-logic test list
- [ ] `.sdd/architecture.md`: touch-layer section
- [ ] Check `.sdd/specs/003-wasm/spec.md` lists touch in its parity scope and describes the stretch scaling

## Phase 8 — Verification and evidence
- [ ] Write `.sdd/specs/004-touch-input/touch-checklist.md`: Handler audit, Call path, Device media values, one row per manual item (Android Chrome, iPad Safari, PC Chrome, PC Firefox), Legibility, Keyboard regression
- [ ] Run the full checklist; every cell pass, fail or n/a with a date ("not available" only for the touchscreen-PC and iPad-with-mouse rows)

## Verification
- [ ] `npm test`
- [ ] `npx tsc --noEmit`
- [ ] `cd server && npx tsc --noEmit`
- [ ] `npm run build`
- [ ] `git diff --stat -- src/physics.ts src/scoring.ts src/mapgen.ts server/` is empty
- [ ] Built bundle checked on both tablets via `npm run build && npm run preview -- --host`
- [ ] PC section of the checklist: no visible change in Chrome and Firefox

## Notes
- 2026-10-27: independent review returned "Reject — needs replan". Resolutions are in `plan.md` § Review follow-up. User decisions: stretch scaling is the rule; "never on a PC" means never when the main pointer is a mouse or trackpad; no touchscreen PC is available for testing.
- 2026-10-27: second review returned "Approve with edits". Edits applied (Phase 0 now also gates on tablet classification; isolation rules for the scene tests); see `plan.md` § Review follow-up. Implementation is not authorized until Phase 0 passes.
- Phase 0 results: (to be filled in)
