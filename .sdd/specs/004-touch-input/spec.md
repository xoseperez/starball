# Spec — 004-touch-input

## Problem
Starball can only be played with a keyboard. On a tablet without one, no menu or game action can be reached: the main menu needs ↑/↓ and Enter, aiming needs the arrow keys, firing needs Space, and leaving a scene needs Esc or Backspace. Only the audio unlock listens for `touchstart` today (`src/app.ts`).

Even with a keyboard attached to the tablet, Esc does not work: the OS treats it as the system Back action and the browser is minimized instead of the game receiving the key. The same happens with the Android back gesture, and on iPadOS an edge swipe goes back in history. Any of these leaves the game and loses the current run.

The constitution lists "Mobile / touch input" under Scope as something the project does not ship, and `003-wasm` repeats that exclusion. This spec is the scope expansion the constitution asks for.

## Goal
Starball is fully playable on a touch-only tablet held in landscape:

- every action available on the keyboard, in every scene and phase, can be done by touch;
- leaving a scene never depends on Esc, and the system Back action (gesture, button, or an Esc key the OS maps to Back) moves back inside the game instead of leaving the page;
- aiming by touch reaches exactly the same angle and power values as the keyboard, with fine and coarse adjustment, so touch players and keyboard players compete on the same leaderboard;
- keyboard play is unchanged, and keyboard and touch can be mixed on a tablet with a keyboard attached;
- on a device used with a mouse or trackpad, which covers every PC including touchscreen laptops, nothing touch-specific appears: no touch buttons, touch hints, rotate prompt or Back interception. The one change a PC player sees is the gameplay HUD bar moving from the top to the bottom of the screen, which every device shares (RQ-021).

The same touch design is used by the TypeScript game and by the Rust/WASM rewrite (`003-wasm`). It lands in the TypeScript game first, so the tablet works now, and becomes part of the parity baseline that `003-wasm` ports. The layouts, timings and back-navigation rules are defined once, as platform-free logic with tests, so the rewrite ports them like it ports physics and scoring.

Target devices: Android tablet with Chrome, and iPad with Safari.

## Non-goals
- Phones as a design target, and portrait play. Phones count as touch devices and get the touch controls, but the minimum touch-target size (RQ-010) is only guaranteed on tablets. Portrait only shows a "rotate to landscape" prompt.
- A setting or switch to force touch controls on or off. Whether they show depends only on the device type.
- Drag-to-aim or any other gesture aiming. Aiming uses buttons only, so touch reaches the same discrete values as the keyboard.
- Gamepad input.
- Changes to physics, scoring, map generation, or the server's replay validation.
- New gameplay, a pause feature, or rebinding controls.
- Haptics or vibration feedback.
- An on-screen text keyboard. Initials entry keeps its letter-cycling design.
- Anything else in `.sdd/constitution.md` § Scope (accounts, telemetry, online multiplayer, replay playback, level editor, i18n).

## User-facing behavior

### Touch devices only
- Everything in this spec that adds something on screen or changes browser behavior applies only on a **touch device**: a tablet or phone whose main pointer is a finger. That covers touch controls, touch hints, the rotate prompt and Back interception.
- The rule is what the browser reports about the main pointer: a device is a touch device when `(pointer: coarse)` and `(hover: none)` both match. A device whose main pointer is a mouse or trackpad is not a touch device, even if it also has a touchscreen, and touching its screen does nothing new, as today. This is the observable meaning of "never on a PC".
- Accepted consequences: a Windows or ChromeOS tablet used without a mouse or trackpad counts as a touch device and shows touch controls, because it could not be played otherwise. An iPad with a mouse or trackpad paired counts as a PC and hides them.
- The browser's user-agent string is not used. iPad Safari reports itself as a Mac by default, and Android Chrome on large tablets requests desktop sites by default.

### Touch mode
- On a touch device, touch controls are shown from the start. They hide when a key is pressed and come back on the next touch, so a tablet with a keyboard shows buttons only while they are in use.
- While touch controls are shown, the key-hint footers (`[↑↓] navigate   [ENTER] select`, etc.) are replaced by touch wording or hidden.
- All controls are drawn on the canvas with the procedural sprite and text code, in DawnBringer 32 colors. No DOM buttons.

### Controls per scene

| Scene / phase | Keyboard (unchanged) | Touch |
|---|---|---|
| Main menu | ↑/↓ move, Enter/Space select | Tap an item to open it |
| Settings | ↑/↓ item, ←/→ adjust, Enter/Esc/Backspace save and return | Tap a row to select it; ◀ ▶ beside its value adjust it; BACK saves and returns |
| High scores | ←/→ difficulty (Endless), Enter/Esc/Backspace return | ◀ ▶ beside the difficulty; BACK |
| Help | ←/→ page, Enter/Space/Esc/Backspace return | ◀ ▶ page controls; BACK |
| Initials entry | ↑/↓ letter, ←/→ slot, Enter next/confirm, Backspace/← edit, Esc skip | ▲ ▼ above and below each letter; tap a letter to move to it; OK for next/confirm; EDIT on the confirm step; BACK skips (with confirmation) |
| Play, Battle, Training: aiming | ←/→ angle, ↑/↓ or +/− power, Shift for coarse steps, Space fire | Rotate ↺ ↻, power − +, FIRE. Hold to repeat; holding longer switches to coarse steps |
| Play: aiming | R reset aim | RESET |
| Training: aiming | N new map, L next hand map, T preview, G gravity field | NEW MAP, NEXT MAP, PREVIEW, FIELD |
| Any shot in flight | A abort (Training: Space as well) | ABORT |
| Play: scored overlay | Space/Enter continue | CONTINUE |
| Play: game over; Battle: match end | Space/Enter to menu | MENU |
| Play, Battle, Training | Esc/Backspace back to menu | BACK |

### Aiming by touch
- One tap changes the value by exactly one fine step: `angle_step_deg` / `power_step_pct` in Play and Battle, 1 in Training. Every value the keyboard can reach can also be reached by touch.
- Holding a button repeats the step after a short delay. Holding past a longer threshold switches to coarse steps (the keyboard's Shift: `shift_multiplier` in Play and Battle, 5 in Training).
- Lifting the finger, sliding it off the button, a system gesture cancelling the touch, or the page losing visibility stops the repeat at once.
- Multi-touch works: one finger can hold power + while another taps FIRE. Each finger only affects the button it pressed.
- Gameplay buttons are shown only in the phase where they act. ABORT replaces them while a shot is in flight; CONTINUE and MENU replace them on overlays.

### Gameplay layout: the bottom bar
- In Play, Battle and Training the 40 px HUD bar sits at the bottom of the screen, below the 640 × 320 playfield, on every device. A finger pressing a button then covers the bar and the lower edge of the screen instead of the playfield. This is a drawing change only: the playfield keeps its logical coordinates, so physics, map generation, hand maps and replays are unaffected.
- In touch mode, BACK and all gameplay controls live in the bottom bar. Nothing is drawn over the playfield except the overlays the game already shows (scored, game over, match end) and their CONTINUE and MENU buttons.
- The bar reads left to right: `[BACK]  [↺ 30° ↻]  [mode]  readouts / toggles  [− 55% +]  [FIRE]`. Angle and power are panels with the value between its two buttons. The mode slot holds RESET in Play and the map level in Training. The middle shows score, level and lives in Play, both players and the round in Battle, and NEW MAP, NEXT MAP, PREVIEW and FIELD in Training. PREVIEW and FIELD are drawn lit while on, which replaces the "preview ON/OFF" text. FIRE is the one primary button, drawn in a stronger color at the right end.
- Every control and readout in the bar shares one center line, so buttons and text line up. Controls have rounded corners and use one button style, one panel style, one primary style and one lit style.
- The keyboard HUD keeps its content and moves to the bottom bar unchanged.
- While a shot is in flight, ABORT is drawn away from FIRE's position, so a double tap on FIRE does not abort the shot.

### Going back
- An on-screen BACK control sits in the top-left corner of every menu scene, and at the left end of the bottom bar in Play, Battle and Training, and does what Esc does there. The exceptions are the main menu, and the Initials screen once the name is saved, where today's scene ignores every key and moves on by itself.
- Where leaving throws away progress (a Play run, a Battle match, an unsaved initials entry), BACK first turns into a highlighted QUIT? button, and a second BACK within 3 s confirms. Elsewhere BACK acts at once. The prompt stays on the BACK button because nothing new may be drawn over the playfield (RQ-012).
- On a touch device, the system Back action does the same as the on-screen BACK, confirmation included. So does the Esc key on a touch device, because on Android it cannot be told apart from the system Back. It leaves the page only from the main menu, where the browser behaves as usual. On a PC, the browser's Back button behaves as today. One Back press is one step back, even when the browser delivers both an Esc key event and a history event for it.

### Browser behavior on the game surface
- No pinch zoom, double-tap zoom, page scroll, overscroll bounce or pull-to-refresh.
- No text selection, long-press callout or context menu.
- No tap delay: a tap acts on touch start or touch end with no noticeable lag.
- On a touch device in portrait, the canvas shows a "rotate to landscape" prompt and ignores game input until the device is rotated back. The game is not paused. A tall browser window on a PC shows no prompt.

### Fullscreen (withdrawn)
- An earlier version added a FULLSCREEN toggle to the main menu. It was withdrawn on 2026-10-27 after play on an Android tablet: the toggle added little, and the stretched canvas looked worse at fullscreen size. The game offers no fullscreen control; RQ-019 is kept as a withdrawn ID.

### Documentation
- On touch devices, Help gets a third page, CONTROLS, that documents the touch controls. Help on a PC keeps its two existing pages (star types and scoring).
- The README controls table gains a touch column.

## Constraints
- **Constitution, Scope.** This feature removes "Mobile / touch input" from the does-not-ship list in `.sdd/constitution.md` and the matching line in `AGENTS.md` § 6. The decision must be recorded in the review responses (`review-response-1.md` and later rounds), as the constitution requires.
- **Physics integrity.** No changes to `src/physics.ts`, `src/scoring.ts`, `src/mapgen.ts` or `server/`. Touch only feeds the existing `AimState`, and replay validation stays as it is. The server already accepts any finite angle and power within [10, 100], so no server change is needed.
- **One code path.** A touch control triggers the same scene handling as its key. Game logic is not duplicated in touch code, so keyboard and touch cannot drift apart.
- **Shared with `003-wasm`.** Layouts (control rectangles in 640 × 360 logical coordinates), repeat timings, the touch-mode switch and the back-navigation rules are pure logic with no DOM types. The DOM wiring (pointer events, History API, CSS gesture suppression) stays a thin layer around them. The Rust rewrite ports the pure parts and their tests, and re-implements only the thin layer.
- **Canvas scaling (decided 2026-10-27).** The game stretches its 640 × 360 logical canvas over the whole window on both axes, at native DPR. This has been the behavior since the "Full screen battle field" commit, and it is now the rule. The constitution's "Scaling is integer-factor only", the letterboxing description in `architecture.md`, the matching line in `AGENTS.md` § 4 and the "integer-scaled" wording in `003-wasm` are out of date and are updated by this feature. Touch positions are mapped with the inverse of this transform, and the touch-target sizes below assume it. Integer scaling would also defeat touch: on a 1024 × 768 viewport the largest integer factor is 1, which leaves 28 px buttons.
- **One layout for drawing and hit-testing.** Each control is defined once and used both to draw it and to test touches against it, so what is drawn is what responds.
- **Touch target size.** Every control is at least 28 × 24 logical px, which is at least 44 CSS px per side on a 1024 × 768 viewport, with at least 4 logical px between controls.
- **Assets and palette.** No binary assets. Icons and labels are procedural and use DawnBringer 32 colors from `src/config.ts` only.
- **Tests.** Tests are pure logic only, with no DOM or canvas tests. Behavior that needs the real device is verified with a manual checklist.
- **Manual checks.** Every "Manual" entry in the contract is run on both an Android tablet with Chrome and an iPad with Safari, and recorded per device in `touch-checklist.md`.
- **Order of work.** Implemented in the TypeScript game now. `003-wasm` treats it as part of today's behavior: touch items join its parity checklist, and the touch test suite is ported to `cargo test` with the other suites.

## Requirements contract

| Requirement ID | Requirement statement | Verification method | Evidence artifact |
|---|---|---|---|
| RQ-001 | Every keyboard action in every scene and phase (table in User-facing behavior) has a touch control that reaches it. | Test — table-driven coverage test: for each scene and phase, the touch layout's actions include every keyboard action. Inspection — a recorded audit comparing the coverage table with every scene's `handleEvent`, line by line. Manual — checklist pass on both tablets. | `npm test` output (touch suite); handler audit and device results in `.sdd/specs/004-touch-input/touch-checklist.md` |
| RQ-002 | A touch control triggers the same scene handling as its key; there is no separate game logic for touch. | Test — real scenes driven under Node: the same action sent as a key event and as a touch control leaves the scene in the same state (cursor, aim, phase, next scene). Inspection — a recorded call-path check that the app routes both inputs into `handleEvent`. | `npm test` output; call-path note in `touch-checklist.md` |
| RQ-003 | Menus and lists work by direct touch: tap an item in the main menu; tap a row and ◀ ▶ in Settings; ◀ ▶ in High scores and Help; ▲ ▼, slot tap, OK and EDIT in Initials entry. | Test — hit-testing of each scene layout (point → action). Manual — checklist pass on the tablet. | `npm test` output; `touch-checklist.md` |
| RQ-004 | An on-screen BACK control in every scene except the main menu does what Esc does there. In Play during a run, Battle during a match and Initials entry before saving, a second BACK within 3 s is needed to confirm. | Test — back state machine: single BACK in plain scenes, a confirmation window in progress scenes, expiry after 3 s. Test — the confirmation rule for each scene and phase: Play before and at game over, Battle before and at match end, Initials while editing, confirming and after saving. Manual — checklist, one row per rule. | `npm test` output; `touch-checklist.md` |
| RQ-005 | On a touch device, the system Back action (back gesture or button, Esc mapped to Back, iPadOS edge swipe) behaves like the on-screen BACK, never leaves the page except from the main menu, and one press is one step even when both a key event and a history event arrive. | Gate — before implementation, a browser spike on Android Chrome and iPad Safari runs the scripted Back sequences against the planned history guard. If either browser cannot meet this requirement, implementation stops until the user decides. Test — back-guard state machine: guard kept while away from the main menu; key and history events for the same press counted once. Manual — the scripted sequences on both tablets from every scene: single Back; double Back within 3 s; Back, wait over 3 s, Back, Back; Back right after entering a scene without touching it; Back after a reload; Esc key; edge swipe on iPad. | Spike results in `tasks.md` Notes; `npm test` output; `touch-checklist.md` |
| RQ-006 | Aiming controls: one tap is one fine step; holding repeats after a delay; holding past a threshold switches to the coarse step; release, sliding off, touch cancel or hidden page stop the repeat at once. Step sizes come from the same settings the keyboard uses (fixed 1 / 5 in Training). | Test — pure repeat scheduler: tap gives one step; given hold durations, the expected count and size of steps; cancel stops further steps. Test — real scenes under Node: fine and coarse steps change angle and power by the configured amounts in Play and Battle, and by 1 and 5 in Training. | `npm test` output |
| RQ-007 | Touch only produces angle and power values the keyboard can produce, and the shared physics, scoring and mapgen modules and the server are unchanged. | Inspection — `git diff --stat` shows no changes under `src/physics.ts`, `src/scoring.ts`, `src/mapgen.ts`, `server/`. Test — existing replay-validation invariant tests pass unmodified. | Diff stat in the review; `npm test` output |
| RQ-008 | Multi-touch: each touch point is tracked separately; releasing one finger does not affect a button held by another. | Test — pointer tracker with interleaved down/up/cancel events for two pointers. Manual — hold power + and tap FIRE. | `npm test` output; `touch-checklist.md` |
| RQ-009 | Touches land on the control drawn under the finger at any viewport size and device pixel ratio. | Test — screen-to-logical mapping at several viewport sizes and DPRs, including non-16:9. Inspection — controls are defined once and used for both drawing and hit-testing. Manual — tap button edges on the tablet. | `npm test` output; `touch-checklist.md` |
| RQ-010 | Every control in every layout is at least 28 × 24 logical px, with at least 4 logical px between controls. | Test — layout invariant check over all scene layouts. | `npm test` output |
| RQ-011 | On a touch device, touch controls are shown from the start, hide on a key press and return on the next touch; key-hint footers are replaced or hidden while touch controls are shown. | Test — touch-mode state switch. Manual — on both tablets with and without a keyboard. | `npm test` output; `touch-checklist.md` |
| RQ-012 | In touch mode, BACK and every gameplay control in Play, Battle and Training sit inside the 640 × 40 bottom bar (screen y 320–360), and every value the keyboard HUD shows (angle, power, score, level, lives, running bonus, both players' names, shots and scores, round, map level) is still shown without overlapping a control. The static scene titles ("PLAY", "BATTLE", "TRAINING") are left out of the touch bar to make room. Only the existing overlays and their CONTINUE / MENU buttons are drawn over the playfield. | Test — layout invariant over each gameplay scene and phase: controls lie within the bottom bar; controls and readout boxes don't overlap. Manual — visual check on both tablets with the longest values (−179°, 100%, six-digit score, eight-character player names), recording for each readout whether the rendered text is legible. | `npm test` output; legibility rows in `touch-checklist.md` |
| RQ-013 | On the game surface there is no browser zoom, scroll, overscroll, pull-to-refresh, text selection, long-press callout or tap delay. | Manual — checklist on the tablet: pinch, double-tap, long-press, swipe down, rapid taps. | `touch-checklist.md` |
| RQ-014 | On a touch device in portrait, the canvas shows a "rotate to landscape" prompt and ignores game input; rotating back to landscape restores the scene where it was. | Test — orientation check from viewport size. Manual — rotate the tablet mid-scene. | `npm test` output; `touch-checklist.md` |
| RQ-015 | Keyboard play is unchanged: every key in the README controls table works as before, on desktop and on a tablet with a keyboard. The one exception is Esc on a touch device, which follows the back rules of RQ-004 and RQ-005. | Manual — keyboard pass through every scene on desktop. Test — existing suites pass unmodified. | `touch-checklist.md` (keyboard section); `npm test` output |
| RQ-016 | Layouts, repeat timings, device classification, the touch-mode switch and back-navigation rules are pure logic with no DOM types, so `003-wasm` can port them and their tests. | Test — a source check that those modules name no browser globals or DOM types, and that their imports, followed transitively, stay inside the pure touch modules and `src/config.ts`. Their tests run under Vitest without a DOM. Inspection in review. | `npm test` output; review notes |
| RQ-017 | Docs reflect the feature: `constitution.md` Scope and `AGENTS.md` § 6 no longer exclude touch; `constitution.md` Game canvas, `architecture.md` and `AGENTS.md` § 4 describe the stretch scaling; the README controls table has a touch column; Help has the touch-only CONTROLS page; `003-wasm/spec.md` includes touch in its parity scope and describes the stretch scaling. | Inspection — review of those files in the diff. | Diff of those files |
| RQ-018 | While a shot is in flight, ABORT is not drawn where FIRE was, so a second tap on FIRE's position does nothing. | Test — layout check: in each gameplay scene, the in-flight ABORT rectangle does not overlap the aiming-phase FIRE rectangle. | `npm test` output |
| RQ-019 | Withdrawn 2026-10-27: there is no fullscreen toggle (see Fullscreen (withdrawn)). | None. | None |
| RQ-020 | Touch features appear only when the browser reports `(pointer: coarse)` and `(hover: none)`. When the main pointer is a mouse or trackpad, as on every PC including touchscreen laptops, the game looks and behaves as before apart from the bottom bar of RQ-021: no touch controls, touch hints or rotate prompt, and browser Back is not intercepted, whether the screen is touched or not. | Test — classification over the four media-query combinations, and touch mode never active on a non-touch device whatever events arrive. Manual — record the reported media values on each test device; desktop Chrome and Firefox with a mouse; both tablets; the iPad with a Bluetooth mouse or trackpad paired, if one is at hand. No touchscreen PC is available, so for those devices the guarantee rests on the media-query rule and is recorded as not tested on hardware. | `npm test` output; `touch-checklist.md` (device and PC sections) |
| RQ-021 | In Play, Battle and Training the HUD bar is drawn at the bottom of the screen (y 320–360) in both keyboard and touch mode, the playfield is drawn above it, and the playfield's logical coordinates used by physics, map generation, hand maps and replays do not change. In touch mode every control and readout in the bar is centered on one horizontal line. | Test — gameplay layout invariant: every bar control and readout lies in y 320–360 and is vertically centered on the bar's center line. Test — existing physics, mapgen and replay suites pass unmodified. Manual — on the Android tablet and on a desktop browser: the bar is at the bottom in every gameplay scene, and buttons and text line up. | `npm test` output; `touch-checklist.md` (bottom bar rows) |

Rules:
- Every requirement must have a unique ID (`RQ-001`, `RQ-002`, ...).
- IDs are stable: once created, do not renumber.
- Verification method must be concrete and project-realistic; tests are optional.
- Evidence artifact must be inspectable by a reviewer (file path, log, report, or explicit manual procedure).

## Open questions
None open for the user.

Resolved after the first device test on an Android tablet (2026-10-27):
- The HUD bar moves to the bottom on every device, so the hand no longer hides the playfield while pressing buttons (RQ-021). The touch bar is redrawn with aligned, rounded controls.
- The fullscreen toggle is withdrawn (RQ-019).
- The pre-implementation Back spike (RQ-005 gate) was waived by the user; the game was tested on the tablet directly. RQ-005 is still checked by the back-guard tests and the manual Back sequences.

Resolved after the independent review (2026-10-27):
- Canvas scaling: the stretch is the rule, and the docs are corrected (Constraints, RQ-017).
- "Never on a PC" means never on a device whose main pointer is a mouse or trackpad (Touch devices only, RQ-020). No touchscreen PC is available for testing.
- System Back: RQ-005 keeps its full guarantee. The history behavior is proven by a browser spike before any implementation, and a failure there stops the work for a user decision instead of being accepted.
- Back confirmation is shown as a QUIT? state of the BACK button. Esc on a touch device follows the back rules (RQ-015 exception). Help gets a touch-only CONTROLS page. There is no BACK on the Initials screen after saving.

Resolved earlier:
- Fullscreen: a touch-mode toggle on the main menu (RQ-019), later withdrawn (see above).
- Aiming scheme: buttons only, no drag-to-aim (Non-goals).
- Gameplay layout: all controls in the HUD bar, playfield kept clear (RQ-012). The launcher can sit anywhere in the left third of the playfield and the goal anywhere in the right third (`src/mapgen.ts`), so corner overlays would cover them.
- Order of work: TypeScript first, ported by `003-wasm` (Constraints).
- Devices: Android Chrome and iPad Safari (Constraints).

Deferred to the plan:
- Exact repeat delay, repeat rate and coarse threshold (target: the full power range 10 → 100 in about 3 s of holding).
- How the system Back guard is kept across browsers, including Chrome's rule that skips history entries added without a user gesture. This is settled by the pre-implementation spike (RQ-005).
