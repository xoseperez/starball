# Tasks — 004-touch-input

Derived from `plan.md`. Check items off as you complete them. Add new items as the work surfaces them — the plan is a forecast; reality wins.

## Phase 0 — Browser gate (before any implementation)
- [x] Build the throwaway guard page in the job scratch directory (same-URL pushes topped up on every tap and key, delayed transition, unwind on "menu", on-screen event log). Never commit it
- [ ] Serve it with `npx vite <scratch-dir> --host` and open it on Android Chrome and iPad Safari
- [ ] Run the RQ-005 sequences on both browsers: single Back; double Back within 3 s; Back, wait over 3 s, Back, Back; Back right after a delayed transition without touching; Back after a reload; Esc with and without `preventDefault()`; iPad edge swipe. Per sequence record browser and version, starting state (guard depth, delayed transition), events in order, and the result (page stayed or left, state reached)
- [ ] Record `(pointer: coarse)`, `(hover: none)`, `(any-pointer: fine)`, `(any-hover: hover)` with browser and version on: each tablet touch-first, without and with its keyboard; the iPad with a Bluetooth mouse or trackpad (if at hand); PC Chrome and Firefox
- [x] ~~Record Fullscreen API availability on iPad Safari~~ (not needed: the fullscreen toggle was withdrawn)
- [x] Check that every scene imports and constructs under Vitest's node environment with the Phase 3 isolation rules
- [ ] (Waived by the user on 2026-10-27, see Notes.) Decision: continue only if (1) every RQ-005 sequence keeps the page on both browsers and (2) both tablets, touch-first with and without keyboard, report `(pointer: coarse)` and `(hover: none)`. Then set `BACK_GUARD_DEPTH` and the arming rules from the results. If either fails, stop and bring the results to the user

## Phase 1 — Pure touch core
- [x] Add touch constants to `src/config.ts` (sizes, gaps, repeat timings, back timings, guard depth from Phase 0, `MONO_ADVANCE`, control color aliases)
- [x] `src/touch/geometry.ts`: `Rect` helpers, `renderTransform()`, `screenToLogical()`
- [x] `src/touch/device.ts`: `isTouchDevice()`, `isPortrait()`
- [x] `src/touch/mode.ts`: `TouchMode` and `TOUCH` singleton (`active` implies `device`)
- [x] `src/touch/controls.ts`: `Control`, `TouchCommand`, `Readout`, `TouchLayout`, `TouchContext`, `BACK_RECT`, `EMPTY_LAYOUT`
- [x] `src/touch/repeat.ts`: `HoldRepeat`
- [x] `src/touch/pointers.ts`: `PointerTracker`
- [x] `src/touch/dispatch.ts`: `dispatch()`
- [x] `src/touch/back.ts`: `backConfirmRule()`, `BackConfirm`, `BackGuard`
- [x] `tests/touch.test.ts`: geometry round trip, device classification, mode switch, repeat scheduler with `coarse` flags, pointer tracker, dispatch, back confirm, back guard with the Phase 0 sequences as cases, `backConfirmRule()` per scene and phase

## Phase 2 — Layouts and the coverage table
- [x] `src/touch/layouts.ts`: `menuLayout`, `settingsLayout`, `highscoresLayout`, `helpLayout`, `initialsLayout`
- [x] `src/touch/layouts.ts`: `gameplayLayout(mode, phase, extras)` for the HUD band and overlays
- [x] `src/touch/keymap.ts`: `REQUIRED_ACTIONS`, transcribed from every scene's `handleEvent`
- [x] Handler audit: compare `REQUIRED_ACTIONS` with every `handleEvent` line by line; record it in `touch-checklist.md`
- [x] Tests: coverage of `REQUIRED_ACTIONS`, hit-testing sample points
- [x] Tests: minimum size and gaps over every layout state, HUD-band containment, readout overlap and capacity, ABORT clear of FIRE
- [x] Tests: source check of the pure files for browser names (including `globalThis`), resolving every static and dynamic import and walking the full closure

## Phase 3 — Scene hooks and touch-mode drawing
- [x] `src/scenes/base.ts`: `isRoot`, `touchLayout()`, `focus()`, `backNeedsConfirm()`
- [x] `src/touch/draw.ts`: `drawControls()` with procedural icons, `drawReadouts()`, `drawRotatePrompt()`
- [x] `src/render.ts`: `maxWidth` option on `drawText`
- [x] `menu.ts`: `isRoot`, `focus()`, `touchLayout()`, footer hidden in touch mode
- [x] `settings.ts`: `focus()`, `touchLayout()`, 28 px row spacing and ◀ ▶ on every row in touch mode, footer hidden
- [x] `highscores.ts`: `touchLayout()`, difficulty without `< >` in touch mode, footer hidden
- [x] `help.ts`: `touchLayout()`, footer hidden (controls page comes in Phase 6)
- [x] `initials.ts`: `focus()`, `backNeedsConfirm()` via `backConfirmRule()`, fixed letter cells and OK/EDIT in touch mode
- [x] `play.ts`: `touchLayout()`, `backNeedsConfirm()` via `backConfirmRule()`, touch HUD from readouts, overlay hints hidden
- [x] `battle.ts`: `touchLayout()`, `backNeedsConfirm()` via `backConfirmRule()`, touch HUD with 116 px player boxes, match-end hint hidden
- [x] `sandbox.ts`: `touchLayout()`, touch HUD with lit PREVIEW / FIELD
- [x] `tests/touch-scenes.test.ts` isolation: mock `src/api.ts`, `resetStoreForTests()` + `SETTINGS.load()` per test, assert no `AudioContext`, no `render()`, fixed seeds for Play/Battle and stubbed `Math.random` for Training, `vi.waitFor` for scene changes, explicit `dt`
- [x] `tests/touch-scenes.test.ts`: key vs touch equivalence per scene, fine and coarse deltas in Play, Battle and Training, scene confirmation hooks against `backConfirmRule()`
- [x] Any scene that cannot follow the isolation rules: move its key-to-state logic into a pure function and test that directly (not needed: every scene ran under the rules)

## Phase 4 — DOM wiring, aiming and menus on the device
- [x] `src/touch/dom.ts`: media queries and change listeners, pointer events with capture, visibility and blur cancel
- [x] `src/touch/dom.ts`: `contextmenu` and `gesturestart` suppression on touch devices
- [x] `src/app.ts`: `renderTransform()`, tracker steps in `tick()`, `drawControls()` in `render()`, `TOUCH.onKey()` in `keydown`
- [x] `src/app.ts`: rotate prompt and input drop on touch devices in portrait
- [x] `index.html`: gesture-suppression CSS
- [ ] Device pass on Android Chrome and iPad Safari: menus, aiming, hold and coarse steps, multi-touch, gestures, HUD fit and legibility

## Phase 5 — Back navigation
- [x] Wire BACK, Esc on touch devices and `popstate` through `BackConfirm` / `BackGuard` with the Phase 0 depth and arming rules; QUIT? label
- [ ] Device pass: the RQ-005 sequences from every scene on both tablets, and one row per confirmation rule

## Phase 6 — Fullscreen and the Help controls page
- [x] Fullscreen toggle in `menuLayout` and `dom.ts`, state from `fullscreenchange` / `webkitfullscreenchange` (later withdrawn, see Phase 9)
- [x] Help page 3 (CONTROLS) on touch devices only

## Phase 7 — Docs
- [x] `.sdd/constitution.md` Scope: remove "Mobile / touch input"
- [x] `.sdd/constitution.md:20` Game canvas: replace integer-factor scaling with the stretch rule
- [x] `.sdd/architecture.md:40`: describe the stretch at native DPR
- [x] `AGENTS.md`: § 6 remove "mobile/touch input"; § 4 (line 68) replace integer-factor scaling with the stretch rule
- [x] `README.md`: Touch column in the controls table
- [x] `.sdd/specs/001-initial-game/prd.md`: lines 11, 196, 203 and § 4.1 Controls
- [x] `.sdd/conventions.md`: add "touch" to the pure-logic test list
- [x] `.sdd/architecture.md`: touch-layer section
- [x] Check `.sdd/specs/003-wasm/spec.md` lists touch in its parity scope and describes the stretch scaling

## Phase 8 — Verification and evidence
- [x] Write `.sdd/specs/004-touch-input/touch-checklist.md`: Handler audit, Call path, Device media values, one row per manual item (Android Chrome, iPad Safari, PC Chrome, PC Firefox), Legibility, Keyboard regression
- [ ] Run the full checklist; every cell pass, fail or n/a with a date ("not available" only for the touchscreen-PC and iPad-with-mouse rows)

## Phase 9 — Tablet feedback: bottom bar, restyle, no fullscreen
- [x] Remove the fullscreen toggle: `fullscreen` command, `FullscreenState`, `TouchContext.fullscreen`, the dispatch hook, the menu button, `dom-fullscreen.ts` and its app wiring
- [x] `src/render.ts`: `withPlayfield` / `withHudBar`; `drawHUD` separator at the top edge of the bar
- [x] `src/config.ts`: palette names `DEEP_BLUE`, `ROYAL_BLUE`, `ROSE`, `DARK_GREEN`, `GREEN`; touch colors `TOUCH_BUTTON*`, `TOUCH_PANEL`, `TOUCH_PRIMARY*`, `TOUCH_ON*`, `TOUCH_TEXT`; remove the first-pass aliases
- [x] `src/touch/controls.ts`: styles "segment" and "primary", `TouchLayout.panels`, `backControl(pending, rect)`
- [x] `src/touch/layout-gameplay.ts`: bottom bar at y 320..360, every control and readout on the y 340 line, angle and power panels, overlay buttons in on-screen coordinates
- [x] `src/touch/draw.ts`: rounded controls and panels, bar band at the bottom, panels drawn with the band
- [x] Play, Battle, Training: playfield inside `withPlayfield`, bar after it (touch bar or keyboard HUD in `withHudBar`); new readout ids; Training key hint hidden in touch mode
- [x] `tests/touch/layouts.test.ts`: bottom-bar bounds, one center line, panels, primary FIRE, new hit points and sample strings
- [x] Docs: `spec.md` (bottom bar, RQ-019 withdrawn, RQ-021 added), `design.md`, `architecture.md`, `AGENTS.md`, `constitution.md`, `prd.md`, `003-wasm/spec.md`, `README.md`, `touch-checklist.md`
- [ ] Device pass on the Android tablet: bar at the bottom in Play, Battle and Training; buttons and text line up; FIRE, steppers and toggles read clearly
- [ ] PC pass: the keyboard HUD shows at the bottom in Play, Battle and Training, unchanged otherwise

## Verification
- [x] `npm test`
- [x] `npx tsc --noEmit`
- [x] `cd server && npx tsc --noEmit`
- [x] `npm run build`
- [x] `git diff --stat -- src/physics.ts src/scoring.ts src/mapgen.ts server/` is empty
- [ ] Built bundle checked on both tablets via `npm run build && npm run preview -- --host`
- [ ] PC section of the checklist: no visible change in Chrome and Firefox

## Notes
- 2026-10-27: independent review returned "Reject — needs replan". Resolutions are in `plan.md` § Review follow-up. User decisions: stretch scaling is the rule; "never on a PC" means never when the main pointer is a mouse or trackpad; no touchscreen PC is available for testing.
- 2026-10-27: second review returned "Approve with edits". Edits applied (Phase 0 now also gates on tablet classification; isolation rules for the scene tests); see `plan.md` § Review follow-up. Implementation is not authorized until Phase 0 passes.
- 2026-10-27: the user asked to execute all phases without waiting between them. The Phase 0 device runs need the user with both tablets, so implementation went ahead before the gate. The gate page is in `.scratch/phase0/` (git-ignored), served with `npx vite .scratch/phase0 --host`. `BACK_GUARD_DEPTH` stays at its starting value 2 until the results are in; if Phase 0 fails, the back navigation must be revisited before release.
- Implementation-level contract: `design.md` in this folder. Deviations from the file names in `plan.md`: tests live in `tests/touch/*.test.ts` (several files, so parallel workers do not collide); `dom.ts` is split into `dom-input.ts`, `dom-history.ts` and `dom-fullscreen.ts`; layouts are split into `layout-menus.ts` and `layout-gameplay.ts`, re-exported by `layouts.ts`; `Control` gained a `style` field and `Readout` gained `align`/`bold`; `Scene` gained `touchFrame`; `BackGuard` gained `setEnabled()` and `onLoad()`.
- Phase 0 results: waived. On 2026-10-27 the user decided not to run the Phase 0 gate and tested the game on an Android tablet directly. RQ-005 still rests on the back-guard tests and the manual Back sequences in `touch-checklist.md`; `BACK_GUARD_DEPTH` stays 2.
- 2026-10-27 tablet feedback from the user: the game works fairly well on the Android tablet; the controls looked ugly, buttons and text in the top bar did not line up, and the hand covered the screen while pressing top-bar buttons; the fullscreen button was not useful and the stretched canvas looked bad at fullscreen size. Decisions: the HUD bar moves to the bottom on every device (PC too), the touch bar is restyled with rounded, aligned controls, and fullscreen is withdrawn (Phase 9).
- 2026-10-27 implementation run: every code, test and doc task is done, by small workers that delegated the coding to the local Pi model. Results: `npm test` 256 tests in 14 files pass; `npx tsc --noEmit` passes at the root and in `server/`; `npm run build` passes; `git diff --stat` of `src/physics.ts`, `src/scoring.ts`, `src/mapgen.ts` and `server/` is empty. Test files: `tests/touch/{geometry,controls,repeat,pointers,dispatch,back,layouts,purity,scenes}.test.ts`. The handler audit in `touch-checklist.md` has 20 rows, all `match`.
- Still open, needs the user with the devices: Phase 0 runs on both tablets, the Phase 4 and Phase 5 device passes, the full `touch-checklist.md`, the built-bundle check on both tablets, and the PC section. Until Phase 0 passes, `BACK_GUARD_DEPTH` (2) is unproven on real browsers.
- `npm install` needed `--cache "$TMPDIR/npm-cache"` inside the sandbox; the lockfile version fields npm rewrote were reverted so the diff only holds the feature.
