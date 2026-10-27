# Touch checklist — 004-touch-input

This is the evidence file for the manual and inspection items of the requirements contract in `spec.md`. Every device cell must read `pass`, `fail` or `n/a`, with a date (YYYY-MM-DD). `not available` is allowed only in the touchscreen-PC column (no such device exists) and the iPad-with-mouse row. Cells not yet run read `pending`.

## Handler audit

`REQUIRED_ACTIONS` (`src/touch/keymap.ts:8`) has 20 entries; each is checked below against the keys the scene's `handleEvent` actually tests in that phase.

| Scene / phase | Keys handled in handleEvent (file:line) | Entry in REQUIRED_ACTIONS | Result |
|---|---|---|---|
| menu | `src/scenes/menu.ts:32` ArrowUp; `:35` ArrowDown (grouped as cursor move = focus); `:38` Enter + Space (grouped synonyms, "select"); cursor also set by `focus()` at `:44` | focus, Enter | match |
| settings | `src/scenes/settings.ts:60` ArrowUp; `:61` ArrowDown (grouped as row cursor = focus); `:62` ArrowLeft + ArrowRight (grouped, "adjust"); `:69` Enter + Escape + Backspace (grouped synonyms used as "back", save and return) | focus, ArrowLeft, ArrowRight, Escape | match |
| highscores.endless | `src/scenes/highscores.ts:47` Enter + Backspace + Escape (grouped synonyms used as "back"); `:51` ArrowLeft + ArrowRight (grouped, "difficulty"; endless mode only) | ArrowLeft, ArrowRight, Escape | match |
| highscores.battle | `src/scenes/highscores.ts:47` Enter + Backspace + Escape (grouped synonyms used as "back"); the ArrowLeft/ArrowRight branch at `:51` is skipped in battle mode | Escape | match |
| help | `src/scenes/help.ts:59` Enter + Escape + Backspace + Space (grouped synonyms used as "back"); `:63` ArrowLeft; `:65` ArrowRight | ArrowLeft, ArrowRight, Escape | match |
| initials.editing | `src/scenes/initials.ts:55` Escape (skip); `:67` ArrowUp; `:69` ArrowDown; `:71` ArrowLeft + `:73` ArrowRight (grouped as slot cursor = focus); `:75` Enter (next/confirm); slot also set by `focus()` at `:84` | ArrowUp, ArrowDown, focus, Enter, Escape | match |
| initials.confirm | `src/scenes/initials.ts:55` Escape (skip); `:60` Enter (commit); `:62` Backspace + ArrowLeft (grouped synonyms, "edit") | Enter, Backspace, Escape | match |
| initials.done | `src/scenes/initials.ts:54` — `handleEvent` returns before any key test once `doneEntry` is set; the scene moves on by itself in `update()` at `:136` | (none) | match |
| play.aim | `src/scenes/play.ts:91` ArrowLeft; `:92` ArrowRight; `:93` ArrowUp + `+` + `=` (grouped synonyms, power up); `:94` ArrowDown + `-` (grouped, power down); `:95` Space (fire); `:96` r (reset); `:81` Escape + Backspace (grouped, back to menu) | ArrowLeft, ArrowRight, ArrowUp, ArrowDown, Space, r, Escape | match |
| play.in_flight | `src/scenes/play.ts:98` a (abort); `:81` Escape + Backspace (grouped, back to menu) | a, Escape | match |
| play.post_shot_scored | `src/scenes/play.ts:101` Enter + Space (grouped, continue); `:81` Escape + Backspace (grouped, back to menu) | Enter, Escape | match |
| play.post_shot_other | `src/scenes/play.ts:101` Enter/Space applies only when the last result is SCORED, so it is skipped here; `:81` Escape + Backspace (grouped, back to menu); the non-scored overlay auto-advances in `update()` at `:214` | Escape | match |
| play.game_over | `src/scenes/play.ts:105` Enter + Space (grouped, back to menu); `:81` Escape + Backspace (grouped, back to menu) | Enter, Escape | match |
| battle.aim | `src/scenes/battle.ts:100` ArrowLeft; `:101` ArrowRight; `:102` ArrowUp + `+` + `=` (grouped synonyms, power up); `:103` ArrowDown + `-` (grouped, power down); `:104` Space (fire); `:90` Escape + Backspace (grouped, back to menu) | ArrowLeft, ArrowRight, ArrowUp, ArrowDown, Space, Escape | match |
| battle.in_flight | `src/scenes/battle.ts:105` a (abort); `:90` Escape + Backspace (grouped, back to menu) | a, Escape | match |
| battle.post_shot | `src/scenes/battle.ts:90` Escape + Backspace (grouped, back to menu); no other key branch in POST_SHOT — the turn auto-advances in `update()` at `:202` | Escape | match |
| battle.round_end | `src/scenes/battle.ts:90` Escape + Backspace (grouped, back to menu); no other key branch in ROUND_END — the next round auto-starts in `update()` at `:202` | Escape | match |
| battle.match_end | `src/scenes/battle.ts:107` Enter + Space (grouped, back to menu); `:90` Escape + Backspace (grouped, back to menu) | Enter, Escape | match |
| training.aim | `src/scenes/sandbox.ts:55` ArrowLeft; `:56` ArrowRight; `:57` ArrowUp + `+` + `=` (grouped synonyms, power up); `:58` ArrowDown + `-` (grouped, power down); `:59` Space (fire); `:60` n (new map); `:63` l (next hand map); `:72` t (preview); `:74` g (gravity field); `:47` Escape + Backspace (grouped, back to menu) | ArrowLeft, ArrowRight, ArrowUp, ArrowDown, Space, n, l, t, g, Escape | match |
| training.in_flight | `src/scenes/sandbox.ts:78` a + Space (grouped synonyms — Space aborts in Training as well); `:47` Escape + Backspace (grouped, back to menu) | a, Escape | match |

Audited on 2026-10-27 against the working tree.

## Call path

Keyboard input reaches the scenes from the `keydown` listener registered in `App.installInput()` (`src/app.ts:168`, listener at `src/app.ts:169`): the listener builds an `InputEvent` and calls `this.scene.handleEvent(inputEvent)` at `src/app.ts:198`. On a touch device the Escape key is intercepted before that call and routed through `BackGuard` instead (`src/app.ts:183-186`), which ends in the same place via `requestBack()`. Touch input reaches the same method through `PointerTracker`: `installTouchInput` (`src/app.ts:210`) forwards pointer events to the tracker, whose `down` results are emitted at `src/app.ts:218`, `up` results at `src/app.ts:226`, and repeat steps for held buttons at `src/app.ts:108` in the main loop; all of them call `App.emit`, which calls `dispatch(this.scene, e, { back })` at `src/app.ts:161`, and `dispatch` calls `target.handleEvent({ key: command.key, shift: emit.coarse })` at `src/touch/dispatch.ts:16`. The `focus` command only moves a cursor: `target.focus(command.index)` (`src/touch/dispatch.ts:19`) reaches `focus()` in `src/scenes/menu.ts:44`, `src/scenes/settings.ts:75` and `src/scenes/initials.ts:84` (each sets only `this.cursor`), and the no-op base `focus` in `src/scenes/base.ts:24` for the other scenes. The BACK control ends in `handleEvent({ key: "Escape" })`: `dispatch` calls `hooks.back()` (`src/touch/dispatch.ts:22`), which is `App.requestBack` (`src/app.ts:154`), and after the `BackConfirm` check it calls `this.scene.handleEvent({ key: "Escape", shift: false })` at `src/app.ts:156`; a history pop ends the same way via `onHistoryPop` → `this.requestBack()` at `src/app.ts:243`.

## Phase 0 browser gate

Waived by the user on 2026-10-27 (the game was tested on an Android tablet directly). The table is kept in case the gate is run later; the RQ-005 rows below still apply.

| Sequence | Android Chrome | iPad Safari |
|---|---|---|
| single Back | pending | pending |
| double Back within 3 s | pending | pending |
| Back, wait more than 3 s, Back, Back | pending | pending |
| Back right after a delayed transition without touching | pending | pending |
| Back after a reload | pending | pending |
| Esc with preventDefault | pending | pending |
| Esc without preventDefault | pending | pending |
| edge swipe (iPad only) | n/a | pending |

| Media query | Android tablet | Android tablet + keyboard | iPad | iPad + keyboard | iPad + mouse/trackpad | PC Chrome | PC Firefox |
|---|---|---|---|---|---|---|---|
| `(pointer: coarse)` | pending | pending | pending | pending | pending | pending | pending |
| `(hover: none)` | pending | pending | pending | pending | pending | pending | pending |
| `(any-pointer: fine)` | pending | pending | pending | pending | pending | pending | pending |
| `(any-hover: hover)` | pending | pending | pending | pending | pending | pending | pending |
| browser and version | pending | pending | pending | pending | pending | pending | pending |

How to run: from the repo root, npx vite .scratch/phase0 --host, then open the printed network URL on each device.

## Device checks

| Requirement | Check | Android Chrome | iPad Safari | PC Chrome | PC Firefox | Touchscreen PC |
|---|---|---|---|---|---|---|
| RQ-001 | Walk every scene and phase of the spec's controls table using only touch: open each menu item, adjust a setting, cycle the high-scores difficulty, page Help, enter initials, aim and fire in Play, Battle and Training; confirm each keyboard action from the table has a touch control that reaches it. | pending | pending | n/a | n/a | not available |
| RQ-003 | Tap each main-menu item to open it; in Settings tap a row to select it and then its ◀ and ▶; cycle difficulty with ◀/▶ in High scores and page with ◀/▶ in Help; in Initials tap a letter to move to it, use ▲/▼ above and below each letter, OK for next/confirm and EDIT on the confirm step. | pending | pending | n/a | n/a | not available |
| RQ-004 | Play during a run: tap BACK — the button turns into a highlighted QUIT?; tap it again within 3 s — the run is abandoned and the menu appears. Also: after QUIT?, touch nothing — the button reverts to BACK after 3 s. | pending | pending | n/a | n/a | not available |
| RQ-004 | Play at game over: on the GAME OVER screen tap BACK — it acts at once (no QUIT?) and the menu appears. | pending | pending | n/a | n/a | not available |
| RQ-004 | Battle during a match: mid-match, tap BACK — QUIT? appears; tap it again within 3 s — the match is abandoned and the menu appears. | pending | pending | n/a | n/a | not available |
| RQ-004 | Battle at match end: on the match-end screen tap BACK — it acts at once (no QUIT?) and the menu appears. | pending | pending | n/a | n/a | not available |
| RQ-004 | Initials editing: while entering the name (before saving), tap BACK — QUIT? appears; tap it again within 3 s — the entry is skipped and the menu appears. | pending | pending | n/a | n/a | not available |
| RQ-004 | Initials after saving: after committing the name the screen shows the rank and advances to High scores by itself; confirm there is no BACK control (and no confirmation) on this screen. | pending | pending | n/a | n/a | not available |
| RQ-005 | Single Back: from each scene (menu, settings, high scores, help, initials, Play, Battle, Training) trigger the system Back once — the game steps back one scene and the page stays open; from the main menu the browser goes back as usual. | pending | pending | n/a | n/a | not available |
| RQ-005 | Double Back within 3 s: from Play mid-run, trigger the system Back twice within 3 s — the first shows QUIT?, the second leaves to the menu; the page is never reloaded. | pending | pending | n/a | n/a | not available |
| RQ-005 | Back, wait more than 3 s, Back, Back: from Play mid-run, system Back, wait over 3 s (QUIT? expires), then Back, Back within 3 s — the second pair shows QUIT? and then leaves. | pending | pending | n/a | n/a | not available |
| RQ-005 | Back right after a delayed transition without touching: after saving initials the scene advances to High scores on its own; trigger system Back immediately, without touching the screen — it acts as if pressed in High scores (one step back), not lost or doubled by the transition. | pending | pending | n/a | n/a | not available |
| RQ-005 | Back after a reload: reload the page, enter a scene, then trigger system Back — one press is one step (no double back from the stale history entry). | pending | pending | n/a | n/a | not available |
| RQ-005 | Esc with preventDefault: in the real game, from every scene, press the physical Esc key on the touch device — the browser neither minimizes nor navigates, and the in-game BACK rule applies (from the main menu the browser goes back; during a run QUIT? appears). | pending | pending | n/a | n/a | not available |
| RQ-005 | Esc without preventDefault: the real game always calls preventDefault on Escape on touch devices (src/app.ts:184), so run this sequence on the Phase 0 gate page (.scratch/phase0) in a variant that does not call preventDefault on Escape, from every scene shown there, and record what the browser does (minimize, navigate, or nothing); then confirm in the real game that the in-game BACK rule still applies. | pending | pending | n/a | n/a | not available |
| RQ-005 | Edge swipe (iPad): swipe in from the edge in each scene — the iPadOS back gesture behaves like the system Back. | n/a | pending | n/a | n/a | not available |
| RQ-008 | Hold the power + button with one finger until it repeats, then tap FIRE with a second finger — the shot fires at the current power and the + repeat continues after the tap; lifting the + finger stops the repeat at once. | pending | pending | n/a | n/a | not available |
| RQ-009 | In touch mode, tap each control exactly on its drawn edge (left edge of ↺, bottom edge of FIRE, corner of BACK) — the control under the finger acts and no neighbor does; repeat after resizing the browser window. | pending | pending | n/a | n/a | not available |
| RQ-011 | On the tablet: at load the touch controls are shown; press any key — they hide; touch the screen again — they come back; while they are shown the key-hint footer is replaced or hidden. Repeat with a keyboard attached and with none attached. | pending | pending | n/a | n/a | not available |
| RQ-012 | In touch mode, in Play, Battle and Training: BACK and every gameplay control sit inside the 40 px bar at the bottom of the screen; nothing is drawn over the playfield except the existing overlays and their CONTINUE / MENU buttons; every keyboard-HUD value (score, level, lives and running bonus; both players' names, shots and scores; round; map level) is still shown and does not overlap a control. | pending | pending | n/a | n/a | not available |
| RQ-013 | Pinch: with two fingers on the canvas, pinch out and pinch in — no page zoom or layout change. | pending | pending | n/a | n/a | not available |
| RQ-013 | Double tap: double-tap a button and double-tap an empty playfield area — no double-tap zoom; each tap acts on the control (or on nothing). | pending | pending | n/a | n/a | not available |
| RQ-013 | Long press: press and hold a control, and an empty area, for more than a second — no text selection, long-press callout or context menu appears. | pending | pending | n/a | n/a | not available |
| RQ-013 | Swipe down from the top: swipe down from the top edge of the screen — no pull-to-refresh or overscroll bounce; the game is unaffected. | pending | pending | n/a | n/a | not available |
| RQ-013 | Rapid taps: tap FIRE (or any button) rapidly several times — each tap acts immediately with no noticeable lag and no missed or duplicated inputs. | pending | pending | n/a | n/a | not available |
| RQ-014 | In a Play run, rotate the tablet to portrait — the canvas shows the rotate-to-landscape prompt and game input is ignored; rotate back to landscape — the same scene continues where it was. | pending | pending | n/a | n/a | not available |
| RQ-015 | Keyboard pass through every scene: using only the README key table, walk menu, settings, high scores, help, initials, Play, Battle and Training and confirm every key works as before. | pending | pending | pending | pending | not available |
| RQ-019 | Withdrawn 2026-10-27: there is no fullscreen toggle, so there is nothing to check. | n/a | n/a | n/a | n/a | n/a |
| RQ-020 | On a PC with a mouse or trackpad: no touch controls, no touch hints and no rotate prompt are shown, and the browser Back button is not intercepted (it navigates as usual). If a touchscreen PC is at hand, also touch the screen — nothing changes. | n/a | n/a | pending | pending | not available |
| RQ-021 | Bottom bar, touch: in Play, Battle and Training the bar with BACK and the controls is at the bottom of the screen; buttons and text share one center line; pressing a bar button does not hide the playfield under the hand. | pending | pending | n/a | n/a | not available |
| RQ-021 | Bottom bar, keyboard: on a PC, in Play, Battle and Training the keyboard HUD (same content as before) is at the bottom of the screen, with the playfield above it; map, launcher, goal and overlays look as before, only moved up by the bar's height. | n/a | n/a | pending | pending | not available |

## Legibility

| Readout | Longest value | Android Chrome | iPad Safari |
|---|---|---|---|
| angle | -179° | pending | pending |
| power | 100% | pending | pending |
| Play score | SCORE 999999 | pending | pending |
| Play info | LV 99   LIVES 5   +12345 | pending | pending |
| Battle player name | ▶ ABCDEFGH | pending | pending |
| Battle player info | ●●● 999999 | pending | pending |
| Battle round | 10/12 | pending | pending |
| Training level | L99 | pending | pending |

An illegible readout fails the row and requires a layout change.

## Keyboard regression

| Scene | Keys to try | PC Chrome | PC Firefox | Tablet + keyboard |
|---|---|---|---|---|
| Menu | ↑/↓ move, Enter/Space select | pending | pending | pending |
| Settings | ↑/↓ item, ←/→ adjust, Enter/Esc/Backspace save and return | pending | pending | pending |
| High scores | ←/→ difficulty (Endless), Enter/Esc/Backspace return | pending | pending | pending |
| Help | ←/→ page, Enter/Space/Esc/Backspace return | pending | pending | pending |
| Initials | ↑/↓ letter, ←/→ slot, Enter next/confirm, Backspace/← edit, Esc skip | pending | pending | pending |
| Play | ←/→ angle, ↑/↓ or +/− power, Shift for coarse steps, Space fire, R reset, A abort, Space/Enter continue, Esc/Backspace back | pending | pending | pending |
| Battle | ←/→ angle, ↑/↓ or +/− power, Shift for coarse steps, Space fire, A abort, Space/Enter to menu, Esc/Backspace back | pending | pending | pending |
| Training | ←/→ angle, ↑/↓ or +/− power, Shift for coarse steps (×5), Space fire, N new map, L next hand map, T preview, G field, Space/A reset, Esc/Backspace back | pending | pending | pending |

On the tablet + keyboard, Esc follows the back rules: during a Play or Battle run it turns BACK into QUIT? and a second Esc within 3 s leaves, instead of acting at once.
