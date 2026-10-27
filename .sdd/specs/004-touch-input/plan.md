# Plan — 004-touch-input

## Approach
Touch gets no game logic of its own. It becomes a second source of the `InputEvent`s that scenes already handle. Each scene describes its touch controls as data, through a pure layout function: rectangles in 640 × 360 logical coordinates, and the commands each one sends. A command is the key event the keyboard would send, or, for the three list scenes, a "focus" that moves the cursor. Each frame the app draws that list and hit-tests touches against the same list. This settles the spec's deferred question in favour of reusing `InputEvent` rather than moving both inputs to named actions. The keyboard branches of every `handleEvent` stay exactly as they are (RQ-015), and a touch control ends in the same `handleEvent` call as its key (RQ-002).

Everything with rules lives in pure modules under `src/touch/`: layouts, hold-repeat, multi-touch tracking, device classification, the touch-mode switch, back confirmation and the history guard. They take numbers and return commands. Two thin files deal with the browser: `src/touch/dom.ts` (events, History API, Fullscreen API) and `src/touch/draw.ts` (canvas). That keeps the whole design testable under the node Vitest environment, and it is the set `003-wasm` ports. The PC guarantee (RQ-020) rests on one flag: `TOUCH.device` comes from the `(pointer: coarse)` and `(hover: none)` media queries, and `TOUCH.active` can only be true when `device` is. Every touch-mode drawing branch and every DOM behavior checks one of the two, so every new branch stays off wherever the main pointer is a mouse or trackpad. Canvas scaling stays the current stretch to the window, which the spec now makes the rule. Touch mapping inverts it, and Phase 7 corrects the docs that still describe integer scaling.

Two things the repo cannot prove are checked on the real browsers before any code is written: how history behaves under the system Back (RQ-005), and what the media queries report on each device (RQ-020). Phase 0 is a gate. If either target browser cannot keep the page from closing, implementation stops and the user decides how to proceed.

## Target shape

### Files
```
src/touch/
  geometry.ts   pure    Rect helpers, renderTransform(), screenToLogical()
  device.ts     pure    isTouchDevice(), isPortrait()
  mode.ts       pure    TouchMode class + TOUCH singleton
  controls.ts   pure    Control / TouchCommand / Readout / TouchLayout types, BACK_RECT, EMPTY_LAYOUT
  layouts.ts    pure    one layout function per scene (+ gameplay HUD and overlays)
  repeat.ts     pure    HoldRepeat
  pointers.ts   pure    PointerTracker
  back.ts       pure    BackConfirm, BackGuard
  dispatch.ts   pure    dispatch() from TouchCommand to scene calls
  keymap.ts     pure    REQUIRED_ACTIONS: keyboard actions per scene and phase (coverage test input)
  draw.ts       canvas  drawControls(), drawReadouts(), drawRotatePrompt(), procedural icons
  dom.ts        DOM     installTouch(): media queries, pointer events, visibility, history, fullscreen, gesture suppression
tests/touch.test.ts     the touch suite (pure logic, plus a source and transitive-import check of the pure files)
tests/touch-scenes.test.ts  real scenes under Node: key vs touch equivalence, step deltas, confirmation rule per phase
```

### Types (`src/touch/controls.ts`)
```ts
export interface Rect { x: number; y: number; w: number; h: number }

export type TouchCommand =
  | { kind: "key"; key: string }      // delivered as InputEvent { key, shift: coarse }
  | { kind: "focus"; index: number }  // Scene.focus(index): menu item, settings row, initials slot
  | { kind: "back" }                  // BackConfirm, then InputEvent { key: "Escape" }
  | { kind: "fullscreen" };           // handled by dom.ts inside the tap handler

export type Icon = "rot_ccw" | "rot_cw" | "minus" | "plus" | "up" | "down" | "left" | "right";

export interface Control {
  id: string;              // stable: "back", "fire", "item:2", "settings:3:right", "slot:1:up"
  rect: Rect;
  label: string | Icon;
  commands: TouchCommand[];
  repeat: boolean;         // act on press and repeat while held (steppers, initials up/down)
  lit?: boolean;           // PREVIEW/FIELD on, BACK waiting for confirmation
}

export interface Readout { id: string; rect: Rect; size: number; maxChars: number }
export interface TouchLayout { controls: Control[]; readouts: Readout[] }

export interface TouchContext {
  backPending: boolean;
  fullscreen: "unavailable" | "off" | "on";
  device: boolean;
}
```

### Scene hooks (`src/scenes/base.ts`)
```ts
readonly isRoot: boolean = false;                 // MenuScene: true
touchLayout(_t: TouchContext): TouchLayout { return EMPTY_LAYOUT; }
focus(_index: number): void {}
backNeedsConfirm(): boolean { return false; }
```
Each scene's `touchLayout()` only gathers its state (phase, cursor, values) and calls the matching pure function in `layouts.ts`. Layout functions never import scenes.

### Pure APIs
```ts
// geometry.ts — renderTransform is lifted out of App.resize()/render() so drawing and mapping share it
renderTransform(viewW, viewH, dpr): { canvasW; canvasH; scaleX; scaleY }
screenToLogical(clientX, clientY, viewW, viewH): { x; y }
contains(r, x, y); overlaps(a, b); gap(a, b)

// device.ts
isTouchDevice(m: { pointerCoarse: boolean; hoverNone: boolean }): boolean   // both true
isPortrait(viewW, viewH): boolean                                            // viewH > viewW

// mode.ts
class TouchMode { device; active; setDevice(b); onKey(); onPointer() }      // active implies device

// repeat.ts
class HoldRepeat { constructor(pressedAt: number); due(now: number): Array<{ coarse: boolean }> }

// pointers.ts
type Emit = { commands: TouchCommand[]; coarse: boolean };
class PointerTracker {
  down(id, x, y, now, layout): Emit[];   // repeat controls emit their first step here
  move(id, x, y, layout): void;          // sliding off a control stops its repeat
  up(id, x, y, layout): Emit[];          // one-shot controls act on release inside the same control
  cancel(id): void; cancelAll(): void;
  tick(now, layout): Emit[];             // due repeat steps; holds whose control left the layout stop
  pressedIds(): ReadonlySet<string>;
}

// back.ts
backConfirmRule(s: { scene: "play" | "battle" | "initials" | "other"; phase?: string; saved?: boolean }): boolean
class BackConfirm { request(now, needsConfirm): "act" | "prompt"; pending(now): boolean; reset(): void }
type HistoryOp = { op: "push"; n: number } | { op: "go"; delta: number };
class BackGuard {
  onActivation(): HistoryOp[];
  onSceneChange(isRoot: boolean): HistoryOp[];
  onEscapeKey(now): { back: boolean; ops: HistoryOp[] };
  onPopState(now, isGuardEntry: boolean): { back: boolean; ops: HistoryOp[] };
  onDeviceLost(): HistoryOp[];
}

// dispatch.ts
interface InputTarget { handleEvent(e: InputEvent): void; focus(index: number): void }
dispatch(target, emit, hooks: { back(): void; fullscreen(): void }): void
```

### Constants (`src/config.ts`)
`TOUCH_MIN_W = 28`, `TOUCH_MIN_H = 24`, `TOUCH_MIN_GAP = 4`, `TOUCH_REPEAT_DELAY_MS = 400`, `TOUCH_REPEAT_INTERVAL_MS = 60`, `TOUCH_COARSE_AFTER_MS = 1200`, `TOUCH_MAX_STEPS_PER_TICK = 3`, `BACK_CONFIRM_MS = 3000`, `BACK_KEY_DEDUPE_MS = 500`, `BACK_GUARD_DEPTH = 2`, `MONO_ADVANCE = 0.6`. Control colors are aliases of existing DawnBringer 32 entries (fill, edge, lit, warning); no new hex values.

Timing check with the default settings (`power_step_pct` 1, `shift_multiplier` 5): holding + gives 1 step on press and about 13 fine steps by 1.2 s, then 5 % every 60 ms. Power goes from 10 to 100 in about 2.1 s, within the spec's target of about 3 s. The numbers get tuned on the device.

### Gameplay HUD in touch mode (logical px, buttons at y = 8, h = 24)

| Slot | x | w | Play aim | Play flight | Battle aim | Battle flight | Training aim | Training flight |
|---|---|---|---|---|---|---|---|---|
| BACK | 4 | 40 | BACK | BACK | BACK | BACK | BACK | BACK |
| A | 48 | 48 | RESET (`r`) | ABORT (`a`) | — | ABORT | — | ABORT |
| ↺ | 100 | 28 | `ArrowLeft`, repeat | — | same | — | same | — |
| angle readout | 130 | 36 | shown in every phase | | | | | |
| ↻ | 168 | 28 | `ArrowRight`, repeat | — | same | — | same | — |
| − | 200 | 28 | `ArrowDown`, repeat | — | same | — | same | — |
| power readout | 230 | 36 | shown in every phase | | | | | |
| + | 268 | 28 | `ArrowUp`, repeat | — | same | — | same | — |
| FIRE | 300 | 48 | `" "` | — | same | — | same | — |

The right side, from x = 352:
- Play: title and running-curvature readout at 352–440 (two rows); score and level/lives readout at 444–634.
- Battle: round readout at 352–396 (`ROUND` / `3/8`); player boxes at 398–514 and 518–634, narrowed from 130 to 116 px in touch mode.
- Training: NEW MAP (`n`) at 352/48, NEXT MAP (`l`) at 404/54, PREVIEW (`t`, lit when on) at 462/48, FIELD (`g`, lit when on) at 514/36, and a title readout at 554–634 (`TRAINING` / `L3`).

ABORT (48–96) sits 204 px from FIRE (300–348) (RQ-018). Readouts are drawn with a `maxWidth` limit, so text is compressed rather than overlapping a control.

Overlays:
- Play, scored: CONTINUE (`Enter`) at (272, `HUD_H + 100 + 16·lines + 8`, 96, 24), replacing `[SPACE] continue`.
- Play, game over: MENU (`Enter`) at (280, `HUD_H + 192`, 80, 24).
- Battle, match end: MENU (`Enter`) at (280, `LOGICAL_H − 36`, 80, 24).

### Other scenes in touch mode
- **BACK** everywhere except the main menu: `BACK_RECT` (4, 8, 40, 24), command `back`. While a confirmation is pending it reads `QUIT?` in the warning color.
- **Menu**: item *i* at (200, 142 + 28·*i*, 240, 24) sends `[focus i, Enter]`. FULLSCREEN at (524, 4, 112, 24), only when available; it reads FULLSCREEN or EXIT FULLSCREEN.
- **Settings**: touch mode draws rows at `y = 84 + 28·i` instead of `90 + 24·i`, because 24 px spacing leaves no room for the 4 px gap. Each row has a row control (84, y − 4, 256, 24) sending `[focus i]`, a ◀ at (346, y − 4, 28, 24) sending `[focus i, ArrowLeft]` and a ▶ at (500, y − 4, 28, 24) sending `[focus i, ArrowRight]`. BACK sends `Escape`, which saves, as today.
- **High scores** (Endless): ◀ at (226, 58, 28, 24) sends `ArrowLeft` and ▶ at (386, 58, 28, 24) sends `ArrowRight`. The difficulty is drawn without its `< >` text.
- **Help**: ◀ at (268, 318, 28, 24) and ▶ at (344, 318, 28, 24) on either side of the page dots. On touch devices Help gets a third page, CONTROLS, that lists the touch controls. A PC keeps the two existing pages.
- **Initials**: touch mode draws the letters in fixed 44 px cells at x = 234, 298 and 362, each glyph centered. The live code measures glyph widths, which a pure layout cannot do.
  - While editing: ▲ at (cell + 8, 100, 28, 24) sends `[focus i, ArrowUp]` with repeat. The letter (cell, 128, 44, 68) sends `[focus i]`. ▼ at (cell + 8, 200, 28, 24) sends `[focus i, ArrowDown]` with repeat. OK at (288, 290, 64, 28) sends `Enter`.
  - On the confirm step: OK at (244, 290, 64, 28) sends `Enter` and EDIT at (332, 290, 64, 28) sends `Backspace`.
  - After the entry is saved there are no controls, since today's handler ignores every key at that point.
- **Key hints**: every key-hint footer and overlay hint is hidden while `TOUCH.active` is true.

### Back navigation
- Back flow: on-screen BACK, and on touch devices also the Esc key and system Back, call `BackConfirm.request(now, scene.backNeedsConfirm())`. `"act"` sends `scene.handleEvent({ key: "Escape", shift: false })`, which is the keyboard's own Esc path. `"prompt"` turns BACK into `QUIT?` for 3 s.
- Which scenes ask for confirmation: each scene's `backNeedsConfirm()` returns the pure `backConfirmRule()` for its current state. Play asks while `phase !== GAME_OVER`, Battle while `phase !== MATCH_END`, and Initials while `!doneEntry`. Every other scene acts at once.
- Esc on touch devices: `keydown` Escape gets `preventDefault()`, which stops Android from falling back from Escape to Back, and goes into the back flow. Esc on a PC is unchanged.
- History guard (touch devices only, `BackGuard`):
  - Arming: while not on the main menu, keep `BACK_GUARD_DEPTH` same-URL entries with state `{ starballGuard: true }`. The depth starts at 2, and Phase 0 sets the final value.
    - Entries are topped up inside every `pointerdown`/`keydown` handler, and right after a scene change while the tap that caused it still counts as recent. Scene changes finish after a dynamic import (`src/scenes/menu.ts:88`), so Phase 0 checks whether that delay still counts as recent on each browser.
    - Chrome skips history entries added without a user gesture. The extra depth covers a run of Back presses with no touch in between, such as Back, wait, Back, Back.
  - System Back: a `popstate` consumes one entry. Within 500 ms of a handled Esc key it is the same press and is ignored. Otherwise it runs the back flow, then the guard re-arms.
  - Back on the menu: on returning to the main menu, `history.go(-depth)` removes the guard entries and the `popstate` it causes is ignored. Back on the menu then leaves the page the browser's usual way.
  - After a reload: if the menu loads on a stale guard entry, a `popstate` there keeps going back until it reaches the base entry.
  - Device becomes a PC (an iPad gets a trackpad): unwind and stop arming.

### DOM and app wiring
- `dom.ts` (all behavior gated on `TOUCH.device`):
  - Device detection: media queries with `change` listeners feed `TOUCH.setDevice()`.
  - Pointers: canvas `pointerdown/move/up/cancel` with `setPointerCapture`, mapped by `screenToLogical()` against `canvas.getBoundingClientRect()`. Hit-testing uses the layout the last frame drew. `visibilitychange` (hidden) and `blur` call `tracker.cancelAll()`.
  - Gestures: `contextmenu` and Safari's `gesturestart` get `preventDefault()`.
  - Fullscreen: `requestFullscreen ?? webkitRequestFullscreen` on `document.documentElement`, called synchronously inside the `pointerup` handler. `fullscreenchange` and `webkitfullscreenchange` update the state.
- `index.html` CSS on `html, body, canvas`: `touch-action: none; user-select: none; -webkit-user-select: none; -webkit-touch-callout: none; -webkit-tap-highlight-color: transparent; overscroll-behavior: none;`. None of these has a visible effect with a mouse.
- `src/app.ts`:
  - `resize()`/`render()` use `renderTransform()`.
  - `keydown` calls `TOUCH.onKey()` (hide controls, cancel pointers) and then behaves as today, except Esc on touch devices.
  - `tick()` dispatches `tracker.tick()` steps before `scene.update()`. On a scene change it resets `BackConfirm`, cancels pointers and calls `BackGuard.onSceneChange()`.
  - `render()`, after `scene.render()`: when `TOUCH.active`, it calls `drawControls(ctx, layout, tracker.pressedIds())`. When the device is a touch device in portrait, it draws the rotate prompt and drops input.
- `src/render.ts`: `drawText` gains an optional `maxWidth`, passed to `fillText`.

## Phases
0. Phase 0 — Browser gate (before any implementation)
   - Throwaway page, kept in the job scratch directory and never committed. It implements the planned guard:
     - same-URL `pushState` entries, topped up on every tap and key;
     - pushes after a delayed, dynamic-import-like transition;
     - unwind on returning to a "menu" state;
     - an on-screen log of every `keydown`, `popstate` and `fullscreenchange`.
   - Serve it on the LAN with `npx vite <scratch-dir> --host` and open it on Android Chrome and iPad Safari.
   - Run the RQ-005 sequences on each browser. For each one, record the browser and version, the starting state (guard depth, delayed transition or not), the events in order, and the result (page stayed or left, and the state the page reached):
     - single Back;
     - double Back within 3 s;
     - Back, wait over 3 s, Back, Back;
     - Back right after a delayed transition, without touching;
     - Back after a reload;
     - Esc with and without `preventDefault()`;
     - edge swipe on iPad.
   - Record the media values `(pointer: coarse)`, `(hover: none)`, `(any-pointer: fine)` and `(any-hover: hover)`, with browser and version, on:
     - each tablet in its touch-first setup (no mouse or trackpad), both without and with its keyboard attached;
     - the iPad with a Bluetooth mouse or trackpad paired, if one is at hand;
     - the PC in Chrome and Firefox.
   - Record whether `document.fullscreenEnabled` / `webkitFullscreenEnabled` is true on iPad Safari, and whether a toggle actually enters and leaves fullscreen. An API that is absent is recorded as unsupported, separately from a supported API that fails.
   - Check that every scene module imports and constructs under Vitest's node environment with the isolation rules of `tests/touch-scenes.test.ts` (Phase 3), using one throwaway test.
   - Decision. Continue only if both of these hold:
     1. every RQ-005 sequence keeps the page on both target browsers;
     2. both tablets, in their touch-first setup with and without the keyboard, report `(pointer: coarse)` and `(hover: none)`.
     - If both hold, fix `BACK_GUARD_DEPTH` and the arming rules from the results and continue.
     - If either fails, stop and bring the results to the user. Neither RQ-005 nor the device rule is relaxed without their decision.
     - All results go in `tasks.md` Notes.
1. Phase 1 — Pure touch core
   - Add the touch constants to `src/config.ts`.
   - `src/touch/geometry.ts`: `Rect` helpers, `renderTransform()` (same arithmetic as `App.resize()`/`render()` today), `screenToLogical()`.
   - `src/touch/device.ts`, `src/touch/mode.ts`.
   - `src/touch/controls.ts`, `src/touch/repeat.ts`, `src/touch/pointers.ts`, `src/touch/dispatch.ts`.
   - `src/touch/back.ts`: `BackConfirm` and `BackGuard`.
   - `tests/touch.test.ts`: geometry round trip, device classification, mode switch, repeat scheduler (including the `coarse` flag on each step), pointer tracker, dispatch, back confirm, the back guard with the Phase 0 sequences as cases, and `backConfirmRule()` for every scene and phase.
2. Phase 2 — Layouts and the coverage table
   - `src/touch/layouts.ts`: `menuLayout`, `settingsLayout`, `highscoresLayout`, `helpLayout`, `initialsLayout`, `gameplayLayout(mode, phase, extras)`, using the coordinates above.
   - `src/touch/keymap.ts`: `REQUIRED_ACTIONS`, transcribed from each scene's `handleEvent` (scene × phase → key or focus).
   - Tests: coverage of `REQUIRED_ACTIONS` by layouts; minimum size and gaps across every layout state; HUD-band containment and no readout overlap in gameplay; ABORT clear of FIRE; readout capacity for the longest values; source check of the pure files for browser names, with their imports followed transitively.
   - Handler audit: compare `REQUIRED_ACTIONS` with every `handleEvent`, line by line, and record the result in the Handler audit section of `touch-checklist.md`. This is independent evidence that the table is complete, since the coverage test can only check layouts against the table.
3. Phase 3 — Scene hooks and touch-mode drawing (inert until Phase 4 sets the device flag)
   - `src/scenes/base.ts`: `isRoot`, `touchLayout()`, `focus()`, `backNeedsConfirm()`.
   - `src/touch/draw.ts`: `drawControls()` with procedural icons (paths, not Unicode glyphs), `drawReadouts()`, `drawRotatePrompt()`.
   - `src/render.ts`: `maxWidth` option on `drawText`.
   - `menu.ts`, `settings.ts`, `highscores.ts`, `help.ts`, `initials.ts`: hooks, touch-mode drawing branches, footers hidden in touch mode.
   - `play.ts`, `battle.ts`, `sandbox.ts`: hooks, touch HUD from layout readouts, overlay hints hidden in touch mode.
   - `tests/touch-scenes.test.ts`, on real scenes under Node:
     - For each scene, send an action once as the keyboard `InputEvent` and once as its touch control through `dispatch()`. Compare the resulting state: cursor, aim, phase, Training toggles, next scene type.
     - Fine and coarse steps change angle and power by `angle_step_deg`/`power_step_pct` and their `shift_multiplier` multiples in Play and Battle, and by 1 and 5 in Training.
     - Each scene's `backNeedsConfirm()` matches `backConfirmRule()` in every phase the test can reach.
     - Tests read private scene fields through a typed cast. Nothing is rendered.
   - Isolation rules for `tests/touch-scenes.test.ts`, so it stays deterministic, does no I/O and keeps to the pure-logic test rule:
     - Network: `vi.mock` replaces `src/api.ts` with stubs resolving to `null`. Without this, `HighscoresScene` starts a fetch in its constructor (`src/scenes/highscores.ts:29`) and `InitialsScene` submits on commit.
     - Storage: `beforeEach` calls `resetStoreForTests()` (`src/persistence.ts:94`), then `SETTINGS.load()`, so every test starts from defaults in an in-memory store. Writes from Settings' save-on-exit stay in memory.
     - Audio: `BANK.play()` returns early while no `AudioContext` exists (`src/audio.ts:54`). Tests never call `BANK.ensure()`, and they assert that `globalThis.AudioContext` is undefined so this cannot change silently.
     - Rendering: tests never call `render()`. `document` is only touched inside drawing and sprite functions (`src/sprites.ts:13`, `src/render.ts:280`).
     - Randomness: Play and Battle are built with a fixed seed (their constructors accept one). Training seeds from `Math.random`, which is stubbed with `vi.spyOn` to a fixed sequence, so paired instances get the same map.
     - Async scene changes: transitions set `nextScene` after an `await import()`. Tests await them with `vi.waitFor(() => scene.nextScene !== null)` and compare only the type of the next scene.
     - Time: `update(dt)` is called with explicit `dt` values; no real timers.
     - If a scene still cannot be driven under these rules, its key-to-state logic is moved into a pure function that both the scene and the test call, instead of being tested through the class.
4. Phase 4 — DOM wiring, aiming and menus on the device
   - `src/touch/dom.ts`: media queries, pointer events, visibility and blur cancel, `contextmenu`/`gesturestart` suppression.
   - `src/app.ts`: `renderTransform()`, tracker in `tick()`, `drawControls()` in `render()`, `TOUCH.onKey()` in `keydown`, rotate prompt and input drop in portrait.
   - `index.html`: gesture-suppression CSS.
   - First device pass on both tablets (menus, aiming, multi-touch, gestures) via `npm run dev -- --host`.
5. Phase 5 — Back navigation
   - Wire BACK, Esc (touch devices) and `popstate` through `BackConfirm`/`BackGuard` in `dom.ts`/`app.ts`, with the depth and arming rules fixed in Phase 0; show the QUIT? label.
   - Device pass: the RQ-005 sequences from every scene on both tablets, plus one row per confirmation rule (RQ-004).
6. Phase 6 — Fullscreen and the Help controls page
   - Fullscreen toggle in `menuLayout` and `dom.ts`; state follows `fullscreenchange`.
   - Help page 3 (CONTROLS) on touch devices only.
7. Phase 7 — Docs
   - `.sdd/constitution.md` Scope: remove "Mobile / touch input".
   - `.sdd/constitution.md:20` Game canvas: replace "Scaling is integer-factor only" with the stretch rule.
   - `.sdd/architecture.md:40` (Fixed logical canvas): describe the stretch at native DPR instead of integer letterboxing.
   - `AGENTS.md` § 6: remove "mobile/touch input". `AGENTS.md:68` (§ 4): replace "Integer-factor scaling only" with the stretch rule.
   - `README.md` controls table: add a Touch column.
   - `.sdd/specs/001-initial-game/prd.md`: lines 11, 196 and 203, and § 4.1 Controls.
   - `.sdd/conventions.md`: add "touch" to the pure-logic test list.
   - `.sdd/architecture.md`: a short touch-layer section (pure core plus DOM shim).
   - Check that `.sdd/specs/003-wasm/spec.md` still lists touch in its parity scope and describes the stretch scaling (both edited during specify and review).
8. Phase 8 — Verification and evidence
   - Write `.sdd/specs/004-touch-input/touch-checklist.md` with these sections:
     - Handler audit (from Phase 2);
     - Call path: both inputs end in `handleEvent`, citing the `app.ts` and `dispatch.ts` lines;
     - Device media values (from Phase 0);
     - one row per manual item in the contract, with columns for Android Chrome, iPad Safari, PC Chrome and PC Firefox;
     - Legibility, for each readout with the longest values;
     - Keyboard regression.
   - Every cell must read pass, fail or n/a, with a date. "Not available" is allowed only for the touchscreen-PC row (none exists) and the iPad-with-mouse row.
   - Run the full checklist; run tests, both type-checks, the build, and the diff stat of the shared modules.

## Sequencing
- Phase 0 comes first and is a hard gate. It needs nothing from the repo and settles the two assumptions the review rated as failing (history guard, device classification). If it fails, nothing else starts.
- Phases 1 and 2 add new files only; no running code imports them yet, so the game is unchanged.
- Phase 3 depends on Phase 2's layouts. Every new branch checks `TOUCH.active`, which stays false until Phase 4 wires the device flag, so the tree still behaves as today everywhere.
- Phase 4 is the first phase where a tablet sees anything. Doing a device pass here, before back navigation, catches font and size problems in the HUD band early, while the coordinates are cheap to change.
- Phase 5 builds the back navigation on rules Phase 0 has already proven, so its remaining risk is wiring, not browser behavior.
- Phases 6 and 7 are independent of each other. Phase 8 needs all of them.
- No phase leaves the tree broken. Each one ends with `npm test` and both type-checks passing.

## Requirement coverage plan

| Requirement ID | Planned implementation touchpoints | Verification approach | Planned evidence artifact |
|---|---|---|---|
| RQ-001 | `layouts.ts` (all scenes), `keymap.ts` `REQUIRED_ACTIONS`, scene `touchLayout()` hooks | Test: for every scene × phase in `REQUIRED_ACTIONS`, some control in the layout sends that key (or a focus for cursor moves); stepper controls have `repeat: true` so coarse steps are reachable. Inspection: recorded handler audit of `REQUIRED_ACTIONS` against every `handleEvent` (Phase 2). Manual: checklist pass on both tablets. | `npm test` output (touch suite); Handler audit and device rows in `touch-checklist.md` |
| RQ-002 | `dispatch.ts`; scenes' `focus()`; `app.ts` calls `dispatch()` only | Test: `dispatch()` into a recording fake `InputTarget` gives the same `InputEvent`s (`key`, `shift`) as the keyboard. Test: `tests/touch-scenes.test.ts` drives real scenes both ways and compares the resulting state. Inspection: recorded call-path check that both inputs end in `handleEvent`; `focus()` only sets the cursor. | `npm test` output; Call path section in `touch-checklist.md` |
| RQ-003 | `menuLayout`, `settingsLayout`, `highscoresLayout`, `helpLayout`, `initialsLayout`; scene drawing branches | Test: hit-testing sample points per layout (item centers, ◀ ▶, ▲ ▼, letter cells, OK/EDIT) returns the expected control. Manual: checklist. | `npm test` output; `touch-checklist.md` |
| RQ-004 | `BACK_RECT` in every non-root layout; `BackConfirm`; `backConfirmRule()`; `backNeedsConfirm()` in `play.ts`, `battle.ts`, `initials.ts` | Test: `BackConfirm` acts at once when no confirmation is needed; prompts, then acts within 3 s; prompts again after 3 s; `reset()` on scene change. Test: `backConfirmRule()` for Play before and at game over, Battle before and at match end, Initials editing, confirming and saved; scene hooks match it (`touch-scenes.test.ts`). Manual: one checklist row per rule. | `npm test` output; `touch-checklist.md` |
| RQ-005 | `BackGuard`; `dom.ts` popstate/pushState/go; Esc routing in `app.ts` | Gate: Phase 0 runs the scripted sequences on both browsers before any code, with no accepted failure. Test: the same sequences as `BackGuard` cases (depth kept away from the menu, popstate runs the back flow and tops up, Esc + popstate within 500 ms counted once, unwind on returning to the menu, stale entries after reload, unwind when the device stops being a touch device). Manual: the sequences from every scene on both tablets. | Phase 0 results in `tasks.md` Notes; `npm test` output; `touch-checklist.md` |
| RQ-006 | `repeat.ts` `HoldRepeat`; `pointers.ts`; config timings; step sizes stay in the scenes (`shift` flag) | Test: a tap gives one fine step; step counts at 399/400/460/1199/1200/1260 ms; the `coarse` flag on each step; at most 3 steps per tick; cancel, slide-off, `cancelAll()` and a control leaving the layout all stop steps. Test: resulting angle and power deltas on real scenes for fine and coarse steps in Play, Battle and Training (`touch-scenes.test.ts`). | `npm test` output |
| RQ-007 | No edits to `src/physics.ts`, `src/scoring.ts`, `src/mapgen.ts`, `server/`; touch only reaches `AimState` through the existing key branches | Inspection: `git diff --stat` on those paths is empty. Test: existing suites, replay invariants included, pass unmodified. | Diff stat in the review; `npm test` output |
| RQ-008 | `PointerTracker` keyed by pointer id; `setPointerCapture` in `dom.ts` | Test: two pointers with interleaved down/up/cancel; releasing one leaves the other's hold repeating. Manual: hold + and tap FIRE. | `npm test` output; `touch-checklist.md` |
| RQ-009 | `renderTransform()` shared by `app.ts` and `screenToLogical()`; one `TouchLayout` per frame for drawing and hit-testing | Test: round trip logical → backing px → CSS px → logical within 0.5 px at 1024×768@2, 1280×800@1.5, 1366×1024@2, 1920×1080@1, 844×390@3, 800×1280@2. Inspection: `drawControls` and the tracker get the same layout object. Manual: tap button edges. | `npm test` output; `touch-checklist.md` |
| RQ-010 | Coordinates in `layouts.ts`; `TOUCH_MIN_*` constants | Test: across every layout state (menu with each fullscreen state, settings, high scores for both modes, help pages, initials editing/confirm/done, every gameplay mode × phase, overlays with 4 and 5 lines), each control is at least 28 × 24, at least 4 px from every other control, and inside 640 × 360. | `npm test` output |
| RQ-011 | `TouchMode`; footers and hints gated on `TOUCH.active` | Test: starts active on a touch device and inactive otherwise; `onKey()` deactivates; `onPointer()` reactivates only on a touch device. Manual: both tablets with and without a keyboard. | `npm test` output; `touch-checklist.md` |
| RQ-012 | `gameplayLayout`; `drawReadouts()` with `maxWidth`; touch HUD branches in `play.ts`, `battle.ts`, `sandbox.ts` | Test: every gameplay control except overlay buttons lies inside y 0–40; no control overlaps a readout; each readout fits its longest value at `MONO_ADVANCE` (−179°, 100 %, six-digit score, eight-character names). Manual: visual check with those values on both tablets, recording per readout whether the rendered (possibly compressed) text is legible. A readout that is not legible fails the row and changes the layout. | `npm test` output; Legibility section in `touch-checklist.md` |
| RQ-013 | `index.html` CSS; `contextmenu`/`gesturestart` suppression in `dom.ts`; one-shot controls act on release with no delay | Manual: pinch, double tap, long press, swipe down from the top, fast taps on both tablets. | `touch-checklist.md` |
| RQ-014 | `isPortrait()`; rotate prompt and input drop in `app.ts` | Test: `isPortrait()` at the edge cases (square, ±1 px). Manual: rotate mid-scene, check the scene continues. | `npm test` output; `touch-checklist.md` |
| RQ-015 | Keyboard branches of `handleEvent` untouched; keyboard-mode drawing untouched; Esc on touch devices follows the back rules (the exception written into spec RQ-015) | Manual: keyboard pass through every scene on PC Chrome and Firefox, and on a tablet with a keyboard. Test: existing suites unmodified. | `touch-checklist.md` (keyboard section); `npm test` output |
| RQ-016 | Pure files listed under Target shape | Test: the source check finds no `window`, `document`, `navigator`, `matchMedia`, `history.`, `globalThis`, `HTML*Element`, `PointerEvent`, `KeyboardEvent` or `CanvasRenderingContext2D` in the pure files. The check resolves every static and dynamic import of the pure files and walks the full closure; that closure contains only the pure `src/touch/` files and `src/config.ts`. Running the pure suite under Node is a second check. Inspection in review. | `npm test` output; review notes |
| RQ-017 | Phase 7 files; Help page 3 | Inspection of the diff. | Diff of `constitution.md` (Scope and Game canvas), `architecture.md`, `AGENTS.md` (§ 4 and § 6), `README.md`, `prd.md`, `conventions.md`, `help.ts`, `003-wasm/spec.md` |
| RQ-018 | Slot A at x 48 for ABORT, FIRE at x 300 | Test: in each gameplay mode, the flight-phase ABORT rectangle does not overlap the aim-phase FIRE rectangle. | `npm test` output |
| RQ-019 | `menuLayout` fullscreen control; `dom.ts` fullscreen request and change events | Manual: on both tablets, enter, exit by toggle, exit by system Back; the scene stays; the next Back follows RQ-005. "Unsupported" (API absent, toggle correctly hidden) is recorded separately from a supported API that fails. | `touch-checklist.md` |
| RQ-020 | `isTouchDevice()`; `TouchMode` invariant (`active` implies `device`); every `dom.ts` behavior and drawing branch gated | Test: classification over the four media-query combinations; `TouchMode` never becomes active with `device` false, whatever the events. Manual: media values recorded per device in Phase 0; PC Chrome and Firefox with a mouse show no change; the iPad with a Bluetooth mouse or trackpad, if at hand. No touchscreen PC exists, so that row reads "not available" and the guarantee there rests on the media-query rule. | `npm test` output; Device media values and PC sections in `touch-checklist.md` |

Test names describe behavior and carry no requirement IDs; this table holds the mapping.

## Verification
- Commands, each run at the end of every phase:
  - `npm test`
  - `npx tsc --noEmit`
  - `cd server && npx tsc --noEmit`
  - `npm run build`
  - `git diff --stat -- src/physics.ts src/scoring.ts src/mapgen.ts server/`, expected to be empty
- Device runs: `npm run dev -- --host` on the PC, then open `http://<pc-lan-ip>:5173` on both tablets. Before signing off, also check the built bundle with `npm run build && npm run preview -- --host`.
- The Phase 0 gate page is a throwaway in the job scratch directory, never committed. Its findings are copied into `tasks.md` Notes, and they are evidence for RQ-005 and RQ-020.
- Manual results are required evidence, not a forecast. A requirement with a "Manual" method is not done until its checklist rows read pass on every listed device.
- Evidence:
  - `touch-checklist.md` holds every manual item from the contract, with pass/fail per device and the date.
  - Test output and the diff stat are pasted into the review notes when the review runs.
- Done means:
  - Phase 0 passed on both browsers;
  - all commands pass;
  - the shared-module diff is empty;
  - every checklist row passes on Android Chrome and iPad Safari;
  - the PC section shows no visible change in Chrome and Firefox;
  - the docs in Phase 7 are updated.

## Open questions
- **Phase 0 outcome.** If either target browser cannot keep the page through the RQ-005 sequences, or either tablet does not report `(pointer: coarse)` and `(hover: none)`, the user decides what happens next. Examples: dropping the QUIT? step for system Back, relaxing RQ-005 on that browser, or refining the device rule. No fallback is pre-accepted.
- **Scene tests under Node.** `tests/touch-scenes.test.ts` relies on the isolation rules in Phase 3. Any scene that cannot follow them has its key-to-state logic moved into a pure function tested directly. Its evidence is never reduced to inspection alone.
- **Battle HUD legibility.** This is the tightest touch row; the player boxes shrink from 130 to 116 px. If the Phase 4 device pass rates any readout illegible, the layout changes. One option is a shorter round readout, which frees width for the player boxes.

Settled (see Review follow-up): canvas scaling, the PC rule, the history-guard fallback, BACK confirmation wording, Esc on touch devices, the Help controls page, no BACK after initials are saved, and Settings re-spacing in touch mode (rows 24 → 28 px, ◀ ▶ on every row, keyboard mode unchanged).

## Review follow-up
How each point in the first review, `review-response-1.md` (Reject — needs replan, 2026-10-27), was handled:

| Review point | Resolution |
|---|---|
| Integer scaling vs. stretch is an unapproved violation | User decision: the stretch is the rule. The spec Constraints record it; Phase 7 updates `constitution.md:20`, `architecture.md:40` and `AGENTS.md:68`; `003-wasm` wording already changed. Touch sizes assume the stretch. |
| Media queries cannot prove "never on a PC" | User decision: the rule is the main pointer as the browser reports it. Spec § Touch devices only and RQ-020 now state it observably, with accepted consequences (tablet-mode PCs show touch UI, an iPad with a mouse hides it). No touchscreen PC exists; that row reads "not available". |
| History guard fallback violates RQ-005 | Fallback removed. Phase 0 tests the guard on both browsers before any code. A failure stops the work for a user decision. The arming rules now top up on every tap and key, and Phase 0 checks the post-import timing. |
| RQ-001 table and test written together | Handler audit recorded in `touch-checklist.md` (Phase 2). |
| RQ-002 fake target proves events, not scene state | `tests/touch-scenes.test.ts` compares real scene state after key vs touch; call path recorded. |
| RQ-004 tests a boolean, not the scene rules | `backConfirmRule()` tested per scene and phase; scene hooks checked against it; one checklist row per rule. |
| RQ-006 schedule only, not deltas | `coarse` flag asserted per step; angle and power deltas checked on real scenes. |
| RQ-012 geometry only, not legibility | Legibility rows per readout and device; an illegible readout fails the row. |
| RQ-016 token scan misses indirect imports | Imports are followed transitively; `globalThis` added to the names checked. |
| Manual results treated as forecast | Checklist cells must read pass, fail or n/a with a date; "not available" only for the touchscreen-PC and iPad-with-mouse rows. |

Second review, `review-response.md` (Approve with edits, 2026-10-27):

| Review point | Resolution |
|---|---|
| Phase 0 gates only on history, not on the tablets classifying as touch devices | Phase 0 Decision now requires both: every RQ-005 sequence keeps the page, and both tablets (touch-first, with and without keyboard) report `(pointer: coarse)` and `(hover: none)`. Either failure stops the work. |
| Scene tests under Node are not isolated from network, storage, audio and async imports | Phase 3 isolation rules: `api.ts` mocked, in-memory store reset per test, audio asserted inert, no rendering, fixed seeds and stubbed `Math.random`, `vi.waitFor` for scene changes, explicit `dt`. A scene that cannot follow them gets a pure extracted function instead. |
| Phase 0 records should include version, start state and resulting state | Added to the Phase 0 recording step. |
| Fullscreen: unsupported vs failed | Recorded separately in Phase 0 and in the RQ-019 row. |
| Transitive import scan must walk the full closure | RQ-016 row now resolves every static and dynamic import; the Node run is a second check. |
| Phase 0 results are not yet evidence | Accepted: implementation starts only after Phase 0 passes. |
