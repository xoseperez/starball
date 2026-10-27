# Design contract — 004-touch-input

Exact interfaces for the implementation of `plan.md`. Every worker implements its section against this contract, so files written in parallel fit together. Where this file and `plan.md` differ, this file wins (it records the implementation-level decisions).

## Rules for all code
- TypeScript ESM, strict. Run `npx tsc --noEmit` and `npm test` from the repo root.
- Default to zero comments. Add one only when the reason is non-obvious, and never mention requirement IDs (`RQ-…`), phases, plan/spec file names or review notes in code or comments.
- Colors only from `src/config.ts` names (DawnBringer 32). No hex literals outside `src/config.ts`.
- No emojis. No binary assets.
- Tests are pure logic under `tests/touch/*.test.ts` (Vitest, `node` environment, globals on; import `describe/it/expect` from `"vitest"` like the existing tests). No DOM, no canvas.
- Do not modify `src/physics.ts`, `src/scoring.ts`, `src/mapgen.ts` or anything under `server/`.
- Never run `git commit` or `git push`.

## File map
Pure (no browser globals, imports only each other and `src/config.ts`):
`src/touch/geometry.ts`, `device.ts`, `mode.ts`, `controls.ts`, `repeat.ts`, `pointers.ts`, `dispatch.ts`, `back.ts`, `layout-menus.ts`, `layout-gameplay.ts`, `layouts.ts`, `keymap.ts`.

Browser side (thin): `src/touch/draw.ts` (canvas), `src/touch/dom-input.ts`, `src/touch/dom-history.ts`. (`dom-fullscreen.ts` was removed with the fullscreen toggle.)

Tests: `tests/touch/geometry.test.ts`, `mode.test.ts`, `repeat.test.ts`, `pointers.test.ts`, `dispatch.test.ts`, `back.test.ts`, `layouts.test.ts`, `purity.test.ts`, `scenes.test.ts`.

## 1. `src/config.ts` additions (append at the end of the file)
```ts
export const TOUCH_MIN_W = 28;
export const TOUCH_MIN_H = 24;
export const TOUCH_MIN_GAP = 4;
export const TOUCH_REPEAT_DELAY_MS = 400;
export const TOUCH_REPEAT_INTERVAL_MS = 60;
export const TOUCH_COARSE_AFTER_MS = 1200;
export const TOUCH_MAX_STEPS_PER_TICK = 3;
export const BACK_CONFIRM_MS = 3000;
export const BACK_KEY_DEDUPE_MS = 500;
export const BACK_GUARD_DEPTH = 2;
export const MONO_ADVANCE = 0.6;
export const TOUCH_WARN = RED;
export const TOUCH_BUTTON = DEEP_BLUE;
export const TOUCH_BUTTON_PRESSED = ROYAL_BLUE;
export const TOUCH_PANEL = BG_COLOR;
export const TOUCH_PRIMARY = RED;
export const TOUCH_PRIMARY_PRESSED = ROSE;
export const TOUCH_ON = DARK_GREEN;
export const TOUCH_ON_PRESSED = GREEN;
export const TOUCH_TEXT = WHITE;
```
Palette names added next to the existing ones: `DEEP_BLUE = PALETTE[15]`, `ROYAL_BLUE = PALETTE[17]`, `ROSE = PALETTE[28]`, `DARK_GREEN = PALETTE[11]`, `GREEN = PALETTE[10]`. (`BG_COLOR`, `WHITE` and `RED` already exist.) The first-pass aliases `TOUCH_FILL`, `TOUCH_FILL_PRESSED`, `TOUCH_EDGE`, `TOUCH_LABEL` and `TOUCH_LIT` were removed with the restyle.

## 2. `src/touch/geometry.ts`
```ts
import { LOGICAL_H, LOGICAL_W } from "../config";
export interface Rect { x: number; y: number; w: number; h: number }
export function contains(r: Rect, x: number, y: number): boolean   // x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h
export function overlaps(a: Rect, b: Rect): boolean                // a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h
export function gap(a: Rect, b: Rect): number                      // dx = max(b.x - (a.x + a.w), a.x - (b.x + b.w), 0); dy likewise; return max(dx, dy)
export interface RenderTransform { canvasW: number; canvasH: number; scaleX: number; scaleY: number }
export function renderTransform(viewW: number, viewH: number, dpr: number): RenderTransform
  // canvasW = Math.round(viewW * dpr); canvasH = Math.round(viewH * dpr); scaleX = canvasW / LOGICAL_W; scaleY = canvasH / LOGICAL_H
export function screenToLogical(cssX: number, cssY: number, viewW: number, viewH: number): { x: number; y: number }
  // x = cssX / viewW * LOGICAL_W; y = cssY / viewH * LOGICAL_H
```

## 3. `src/touch/device.ts`
```ts
export function isTouchDevice(m: { pointerCoarse: boolean; hoverNone: boolean }): boolean  // both true
export function isPortrait(viewW: number, viewH: number): boolean                          // viewH > viewW
```

## 4. `src/touch/mode.ts`
```ts
export class TouchMode {
  get device(): boolean;
  get active(): boolean;          // invariant: active implies device
  setDevice(isTouch: boolean): void  // device = isTouch; active = isTouch
  onKey(): void                    // active = false
  onPointer(): void                // if (device) active = true
}
export const TOUCH = new TouchMode();   // starts with device = false, active = false
```

## 5. `src/touch/controls.ts`
```ts
import { contains, type Rect } from "./geometry";
export type { Rect } from "./geometry";
export type TouchCommand =
  | { kind: "key"; key: string }
  | { kind: "focus"; index: number }
  | { kind: "back" };
export type Icon = "rot_ccw" | "rot_cw" | "minus" | "plus" | "up" | "down" | "left" | "right";
export const ICONS: readonly Icon[] = ["rot_ccw", "rot_cw", "minus", "plus", "up", "down", "left", "right"];
export function isIcon(label: string): label is Icon
export interface Control {
  id: string;
  rect: Rect;
  label: string;                 // an Icon name or plain text
  commands: TouchCommand[];
  repeat: boolean;               // acts on press and repeats while held
  style: "button" | "area" | "segment" | "primary";
  // "area" = invisible hit zone over content the scene draws itself;
  // "segment" = a stepper half inside a panel, filled only while pressed;
  // "primary" = the one strong button of a layout (FIRE)
  lit?: boolean;
}
export interface Readout {
  id: string;
  rect: Rect;
  size: number;                  // font px
  maxChars: number;              // longest value it must hold
  align: "left" | "center" | "right";
  bold: boolean;
}
export interface TouchLayout { controls: Control[]; readouts: Readout[]; panels?: Rect[] }   // panels: rounded backgrounds drawn with the bar, under readouts
export interface TouchContext { backPending: boolean; device: boolean }
export interface Emit { commands: TouchCommand[]; coarse: boolean }
export const BACK_RECT: Rect = { x: 4, y: 8, w: 40, h: 24 };
export const EMPTY_LAYOUT: TouchLayout = { controls: [], readouts: [] };
export function backControl(pending: boolean, rect: Rect = BACK_RECT): Control
  // { id: "back", rect, label: pending ? "QUIT?" : "BACK", commands: [{ kind: "back" }], repeat: false, style: "button", lit: pending }
export function findControl(layout: TouchLayout, x: number, y: number): Control | null   // first control whose rect contains the point
export function controlById(layout: TouchLayout, id: string): Control | null
```

## 6. `src/touch/repeat.ts`
```ts
export class HoldRepeat {
  constructor(pressedAt: number);
  due(now: number): Array<{ coarse: boolean }>;
}
```
Semantics: the press itself is emitted by the pointer tracker, not by `HoldRepeat`. Repeat slots fall at `pressedAt + TOUCH_REPEAT_DELAY_MS + k * TOUCH_REPEAT_INTERVAL_MS` for k = 0, 1, 2, …. `due(now)` finds every slot with time <= now that has not been consumed yet, marks them all consumed, and returns only the last `min(n, TOUCH_MAX_STEPS_PER_TICK)` of them (oldest overdue slots are dropped). A slot is `coarse` when `slotTime - pressedAt >= TOUCH_COARSE_AFTER_MS`.
Reference values with the defaults, calling `due` every 10 ms from the press: nothing before 400; first step at 400; second at 460; 14 steps (all fine) by 1199; no new step at 1200; the 15th step, at 1240, is the first coarse one.

## 7. `src/touch/pointers.ts`
```ts
import type { Emit, TouchLayout } from "./controls";
export class PointerTracker {
  down(id: number, x: number, y: number, now: number, layout: TouchLayout): Emit[];
  move(id: number, x: number, y: number, layout: TouchLayout): void;
  up(id: number, x: number, y: number, layout: TouchLayout): Emit[];
  cancel(id: number): void;
  cancelAll(): void;
  tick(now: number, layout: TouchLayout): Emit[];
  pressedIds(): ReadonlySet<string>;
}
```
Per pointer id, track `{ controlId, isRepeat, repeat: HoldRepeat | null, inside: boolean }`.
- `down`: `findControl`. No control: track nothing, return []. Repeat control: track with a new `HoldRepeat(now)` and return `[{ commands, coarse: false }]` (the first step acts at once). One-shot control: track, return [].
- `move`: if the point is no longer inside the tracked control's rect (looked up by id in `layout`; missing counts as outside), set `inside = false` and `repeat = null`. Once outside, it stays outside.
- `up`: stop tracking. Return `[{ commands, coarse: false }]` only for a one-shot control that is still present in `layout`, still `inside`, and contains the release point; otherwise [].
- `cancel` / `cancelAll`: stop tracking without emitting.
- `tick`: for each tracked pointer with a `repeat`: if its control id is missing from `layout`, stop tracking it; else emit one `{ commands, coarse }` per step from `repeat.due(now)`.
- `pressedIds`: control ids of tracked pointers that are `inside`.

## 8. `src/touch/dispatch.ts`
```ts
import type { Emit } from "./controls";
export interface InputTarget { handleEvent(e: { key: string; shift: boolean }): void; focus(index: number): void }
export interface DispatchHooks { back(): void }
export function dispatch(target: InputTarget, emit: Emit, hooks: DispatchHooks): void
```
Commands run in order: `key` → `target.handleEvent({ key, shift: emit.coarse })`; `focus` → `target.focus(index)`; `back` → `hooks.back()`.

## 9. `src/touch/back.ts`
```ts
export type ConfirmScene = "play" | "battle" | "initials" | "other";
export function backConfirmRule(s: { scene: ConfirmScene; phase?: string; saved?: boolean }): boolean
  // play: phase !== "game_over"; battle: phase !== "match_end"; initials: !saved; other: false
export class BackConfirm {
  request(now: number, needsConfirm: boolean): "act" | "prompt";
  pending(now: number): boolean;
  reset(): void;
}
export type HistoryOp = { op: "push"; n: number } | { op: "go"; delta: number };
export interface BackResult { back: boolean; ops: HistoryOp[] }
export class BackGuard {
  constructor(targetDepth?: number);           // default BACK_GUARD_DEPTH
  setEnabled(on: boolean): HistoryOp[];
  onLoad(guardIndex: number): HistoryOp[];
  onActivation(): HistoryOp[];
  onSceneChange(isRoot: boolean): HistoryOp[];
  onEscapeKey(now: number): BackResult;
  onPopState(now: number, isGuardEntry: boolean): BackResult;
}
```
`BackConfirm`: holds `until` (start -Infinity). `request`: if `!needsConfirm` → reset, "act". Else if `now < until` → reset, "act". Else `until = now + BACK_CONFIRM_MS`, "prompt". `pending(now)` = `now < until`.

`BackGuard` state: `enabled = false`, `atRoot = true`, `depth = 0`, `ignorePops = 0`, `lastEscAt = -Infinity`.
- `setEnabled(on)`: if unchanged → []. Set it. When turning off → `unwind()`; when turning on → [].
- `unwind()` (private): if `depth === 0` → []. Else `d = depth; depth = 0; ignorePops += 1;` → `[{ op: "go", delta: -d }]`.
- `onLoad(guardIndex)`: if `guardIndex > 0` → `ignorePops += 1` → `[{ op: "go", delta: -guardIndex }]`; else []. (Independent of `enabled`: stale entries from a reload are always removed.)
- `onActivation()`: if `!enabled || atRoot || depth >= targetDepth` → []. Else `n = targetDepth - depth; depth = targetDepth;` → `[{ op: "push", n }]`.
- `onSceneChange(isRoot)`: `atRoot = isRoot`. If `!enabled` → []. If root → `unwind()`. Else → `onActivation()`.
- `onEscapeKey(now)`: if `!enabled` → `{ back: false, ops: [] }`. `lastEscAt = now` → `{ back: !atRoot, ops: [] }`.
- `onPopState(now, isGuardEntry)`:
  1. if `ignorePops > 0` → `ignorePops -= 1` → `{ back: false, ops: [] }`.
  2. if `!enabled` → `{ back: false, ops: [] }`.
  3. if `atRoot`: if `isGuardEntry` → `ignorePops += 1` → `{ back: false, ops: [{ op: "go", delta: -1 }] }`; else `{ back: false, ops: [] }`.
  4. else: `if (depth > 0) depth -= 1;` then `ops = onActivation()` (top up). If `now - lastEscAt <= BACK_KEY_DEDUPE_MS` → `{ back: false, ops }` (same press as the Esc key already handled). Else `{ back: true, ops }`.

## 10. Layouts
All coordinates are px in the 640 × 360 canvas as drawn on screen. `HUD_H = 40`, `PLAYFIELD_H = 320`, `LOGICAL_H = 360` from `src/config.ts`. Every non-root layout starts with a `backControl`. Menu scenes draw in canvas coordinates directly. Gameplay scenes draw their playfield shifted up by `HUD_H` (logic keeps it at y 40..360) and the bar at canvas y 320..360, so gameplay layout rectangles are canvas coordinates too: the bar is y 320..360 and the playfield is y 0..320.

### `src/touch/layout-menus.ts`
```ts
export function menuLayout(itemCount: number): TouchLayout
export function settingsRowY(i: number): number        // 84 + 28 * i (text top in touch mode)
export function settingsLayout(rowCount: number, backPending: boolean): TouchLayout
export function highscoresLayout(endless: boolean, backPending: boolean): TouchLayout
export function helpLayout(backPending: boolean): TouchLayout
export const INITIALS_CELLS: readonly number[] = [234, 298, 362];   // cell x; width INITIALS_CELL_W
export const INITIALS_CELL_W = 44;
export type InitialsStep = "editing" | "confirm" | "done";
export function initialsLayout(step: InitialsStep, backPending: boolean): TouchLayout
```
- Menu (no BACK): item i → id `item:i`, rect (200, 142 + 28i, 240, 24), label "", commands `[focus i, key "Enter"]`, style "area".
- Settings: for row i with `y = settingsRowY(i)`: `settings:i:row` (84, y − 4, 256, 24) area `[focus i]`; `settings:i:left` (346, y − 4, 28, 24) label "left" `[focus i, key "ArrowLeft"]` button; `settings:i:right` (500, y − 4, 28, 24) label "right" `[focus i, key "ArrowRight"]` button.
- High scores: if endless: `hs:left` (226, 58, 28, 24) "left" `[key "ArrowLeft"]`; `hs:right` (386, 58, 28, 24) "right" `[key "ArrowRight"]`.
- Help: `help:left` (268, 318, 28, 24) "left" `[key "ArrowLeft"]`; `help:right` (344, 318, 28, 24) "right" `[key "ArrowRight"]`.
- Initials, editing: for cell i with `x = INITIALS_CELLS[i]`: `slot:i:up` (x + 8, 100, 28, 24) "up" `[focus i, key "ArrowUp"]` repeat; `slot:i:letter` (x, 128, 44, 68) area `[focus i]`; `slot:i:down` (x + 8, 200, 28, 24) "down" `[focus i, key "ArrowDown"]` repeat. Then `ok` (288, 290, 64, 28) "OK" `[key "Enter"]`.
- Initials, confirm: `ok` (244, 290, 64, 28) "OK" `[key "Enter"]`; `edit` (332, 290, 64, 28) "EDIT" `[key "Backspace"]`.
- Initials, done: no controls at all (no BACK either).
All menu-type layouts have `readouts: []`.

### `src/touch/layout-gameplay.ts`
```ts
export type GameMode = "play" | "battle" | "training";
export type GamePhase = "aim" | "in_flight" | "post_shot" | "round_end" | "game_over" | "match_end";
export interface GameplayExtras { backPending: boolean; scored?: boolean; overlayLines?: number; previewOn?: boolean; fieldOn?: boolean }
export function gameplayLayout(mode: GameMode, phase: GamePhase, extras: GameplayExtras): TouchLayout
```
The bar is canvas y 320..360. Every bar control is a full row: y = 326, h = 28, so its center is on the bar line y = 340. Readouts are either a full row (y 326, h 28) or a half row (top: y 326, h 14; bottom: y 340, h 14), so a two-line stack is centered on the same line. Left to right: BACK, angle panel, slot A, middle, power panel, FIRE.
- Always: `backControl(extras.backPending, (6, 326, 42, 28))`. Panels (every phase): angle panel (54, 326, 104, 28), power panel (442, 326, 104, 28).
- Phase "aim":
  - `rot_ccw` (54, 326, 32, 28) "rot_ccw" `[key "ArrowLeft"]` repeat, style "segment"; `rot_cw` (126, 326, 32, 28) "rot_cw" `[key "ArrowRight"]` repeat, "segment"; `pwr_down` (442, 326, 32, 28) "minus" `[key "ArrowDown"]` repeat, "segment"; `pwr_up` (514, 326, 32, 28) "plus" `[key "ArrowUp"]` repeat, "segment"; `fire` (552, 326, 82, 28) "FIRE" `[key " "]`, style "primary".
  - play only: `reset` in slot A (164, 326, 48, 28) "RESET" `[key "r"]`.
  - training only: `new_map` (218, 326, 50, 28) "NEW MAP" `[key "n"]`; `next_map` (272, 326, 52, 28) "NEXT MAP" `[key "l"]`; `preview` (328, 326, 52, 28) "PREVIEW" `[key "t"]` lit = previewOn; `field` (384, 326, 52, 28) "FIELD" `[key "g"]` lit = fieldOn.
- Phase "in_flight": `abort` in slot A (164, 326, 48, 28) "ABORT" `[key "a"]` (all modes), well away from FIRE.
- Phase "post_shot": play with `scored`: `continue` (272, 100 + 16 * (overlayLines ?? 4) + 8, 96, 24) "CONTINUE" `[key "Enter"]`. Otherwise nothing extra.
- Phase "game_over" (play): `menu` (280, 192, 80, 24) "MENU" `[key "Enter"]`.
- Phase "match_end" (battle): `menu` (280, 284, 80, 24) "MENU" `[key "Enter"]`.
- Phase "round_end": nothing extra.

Readouts:
- All modes, every phase: `angle` (86, 326, 40, 28) size 12 bold maxChars 5 center; `power` (474, 326, 40, 28) size 12 bold maxChars 4 center (each sits between its two stepper segments).
- play: `score` (218, 326, 218, 14) size 12 bold maxChars 12 center; `info` (218, 340, 218, 14) size 11 maxChars 24 center.
- battle: `p1_name` (218, 326, 80, 14) size 11 bold maxChars 10 left; `p1_info` (218, 340, 80, 14) size 11 maxChars 10 left; `round_label` (298, 326, 58, 14) size 10 maxChars 5 center; `round_value` (298, 340, 58, 14) size 11 bold maxChars 5 center; `p2_name` (356, 326, 80, 14) size 11 bold maxChars 10 right; `p2_info` (356, 340, 80, 14) size 11 maxChars 10 right.
- training: `level` size 12 bold maxChars 3 center, in slot A (164, 326, 48, 28) while aiming and in the middle (218, 326, 218, 28) otherwise.
- The static scene titles of the keyboard HUD ("PLAY", "BATTLE", "TRAINING") are not shown in the touch bar.

### `src/touch/layouts.ts`
Re-exports everything from `layout-menus.ts` and `layout-gameplay.ts`.

## 11. `src/touch/keymap.ts`
```ts
export type RequiredAction = { key: string } | { focus: true };
export const REQUIRED_ACTIONS: Record<string, RequiredAction[]>;
export function covers(layout: TouchLayout, action: RequiredAction): boolean
```
`covers`: a `{ focus: true }` action is covered by any control with a `focus` command; a `{ key: K }` action by any control with a `key` command for K, and `Escape` is also covered by a `back` command.
Entries (one canonical key per keyboard action; synonyms such as `+`/`=` or Enter-as-back are not listed):
- `menu`: focus, Enter
- `settings`: focus, ArrowLeft, ArrowRight, Escape
- `highscores.endless`: ArrowLeft, ArrowRight, Escape
- `highscores.battle`: Escape
- `help`: ArrowLeft, ArrowRight, Escape
- `initials.editing`: ArrowUp, ArrowDown, focus, Enter, Escape
- `initials.confirm`: Enter, Backspace, Escape
- `initials.done`: (none)
- `play.aim`: ArrowLeft, ArrowRight, ArrowUp, ArrowDown, " ", r, Escape
- `play.in_flight`: a, Escape
- `play.post_shot_scored`: Enter, Escape
- `play.post_shot_other`: Escape
- `play.game_over`: Enter, Escape
- `battle.aim`: ArrowLeft, ArrowRight, ArrowUp, ArrowDown, " ", Escape
- `battle.in_flight`: a, Escape
- `battle.post_shot`: Escape
- `battle.round_end`: Escape
- `battle.match_end`: Enter, Escape
- `training.aim`: ArrowLeft, ArrowRight, ArrowUp, ArrowDown, " ", n, l, t, g, Escape
- `training.in_flight`: a, Escape

## 12. `src/render.ts` changes
- Add `maxWidth?: number` to `TextOpts`. In `drawText`, when `opts.maxWidth` is defined, pass it as the 4th argument of both `fillText` calls (shadow and main).
- `withPlayfield(ctx, draw)`: save, translate (0, −HUD_H), draw, restore. Gameplay scenes draw the map, trails, previews, banners and overlays inside it, in the same logical coordinates as before, so they land on canvas y 0..320.
- `withHudBar(ctx, draw)`: save, translate (0, PLAYFIELD_H), draw, restore. The keyboard HUD (`drawHUD`, and Battle's own HUD) is drawn inside it, so it lands on canvas y 320..360. Its separator line moves to the top edge of the bar (y 0.5 inside the bar).

## 13. `src/touch/draw.ts` (canvas side)
```ts
export interface ReadoutValue { text: string; color?: Color }
export function drawHudBand(ctx: CanvasRenderingContext2D, panels: readonly Rect[] = []): void
export function drawControls(ctx: CanvasRenderingContext2D, layout: TouchLayout, pressed: ReadonlySet<string>): void
export function drawReadouts(ctx: CanvasRenderingContext2D, readouts: Readout[], values: Record<string, ReadoutValue | undefined>): void
export function drawRotatePrompt(ctx: CanvasRenderingContext2D): void
```
- Colors as `rgba(r, g, b, a)` strings built from `src/config.ts` colors (write a local helper; `cssColor` in `render.ts` is not exported). All shapes are rounded rectangles with radius 6 (clamped to half the side), drawn as an `arcTo` path.
- `drawHudBand`: fill `HUD_BG` over (0, PLAYFIELD_H, LOGICAL_W, HUD_H), a 1 px `DARK_GRAY` line at y = PLAYFIELD_H + 0.5, then each panel filled with `TOUCH_PANEL`. Panels are drawn here, not in `drawControls`, because the scene draws its readouts right after the band and the app draws controls after the scene; panels drawn later would cover the angle and power values.
- `drawControls`: "area" controls draw nothing unless pressed (then a `ROYAL_BLUE` fill at alpha 0.35). "segment" controls have no fill unless pressed (`TOUCH_BUTTON_PRESSED`). "primary" fills `TOUCH_PRIMARY` (`TOUCH_PRIMARY_PRESSED` when pressed). A lit BACK (QUIT?) fills `TOUCH_WARN` (`TOUCH_PRIMARY_PRESSED` when pressed). Other lit buttons fill `TOUCH_ON` (`TOUCH_ON_PRESSED`). Plain buttons fill `TOUCH_BUTTON` (`TOUCH_BUTTON_PRESSED`). Labels and icons are `TOUCH_TEXT`. Icons are canvas paths centered in the rect with size `s = Math.min(w, h) * 0.5`, line width 2.5, round caps and joins: minus (horizontal bar), plus (bar + vertical bar), up/down/left/right (filled triangles), rot_ccw/rot_cw (a 270° arc of radius s/2 starting at the top, anticlockwise or clockwise, with a filled arrowhead tangent to its end). Text labels: `drawText` bold, size 12 for "primary" and 10 otherwise, centered, baseline "middle", `maxWidth: rect.w - 4`.
- `drawReadouts`: for each readout with a value: x = left edge, center or right edge by `align`; y = rect.y + rect.h / 2; `drawText(ctx, text, x, y, { size, bold, color: value.color ?? PALE_CYAN, align, baseline: "middle", maxWidth: rect.w })`.
- `drawRotatePrompt`: fill the whole logical canvas with `BG_COLOR`; "ROTATE TO LANDSCAPE" size 20 bold `YELLOW` centered at (LOGICAL_W / 2, 160); "Starball plays in landscape" size 12 `PALE_CYAN` centered at (LOGICAL_W / 2, 196).

## 14. Scene hooks (`src/scenes/base.ts`)
```ts
import { EMPTY_LAYOUT, type TouchContext, type TouchLayout } from "../touch/controls";
export interface InputEvent { key: string; shift: boolean }   // unchanged
export abstract class Scene {
  nextScene: Scene | null = null;
  readonly isRoot: boolean = false;
  touchFrame: TouchLayout = EMPTY_LAYOUT;     // set by App every frame before render()
  handleEvent(_event: InputEvent): void {}
  update(_dt: number): void {}
  abstract render(ctx: CanvasRenderingContext2D): void;
  touchLayout(_t: TouchContext): TouchLayout { return EMPTY_LAYOUT; }
  focus(_index: number): void {}
  backNeedsConfirm(): boolean { return false; }
}
```
Scenes read `TOUCH.active` / `TOUCH.device` from `../touch/mode`. Keyboard-mode drawing and every existing `handleEvent` branch stay exactly as they are; touch mode adds alternative drawing branches only.

Per scene:
- `menu.ts`: `override readonly isRoot = true`; `focus(i)` sets the cursor when 0 <= i < items.length; `touchLayout(t)` → `menuLayout(this.items.length)`; footer hint not drawn while `TOUCH.active`.
- `settings.ts`: `focus(i)` sets the cursor when in range; `touchLayout(t)` → `settingsLayout(ITEMS.length, t.backPending)`. While `TOUCH.active`, rows are drawn at `settingsRowY(i)` instead of `90 + 24 * i`; the cursor `>` beside the label stays; the `<` / `>` around the value are not drawn (touch draws ◀ ▶ controls); footer hint not drawn.
- `highscores.ts`: `touchLayout(t)` → `highscoresLayout(this.mode === "endless", t.backPending)`. While `TOUCH.active`, the difficulty is drawn as just the name (no `< >`), and the bottom key hint is not drawn (the source label stays).
- `help.ts`: page count is 3 when `TOUCH.device`, else 2 (replace the constant in the handler and the page indicator). `touchLayout(t)` → `helpLayout(t.backPending)`. Footer hint not drawn while `TOUCH.active`. Page index 2 is a CONTROLS page drawn only on touch devices, listing the touch controls (see section 16).
- `initials.ts`: `focus(i)` sets the cursor (clamped 0..2) only while editing (`!doneEntry && !awaitingConfirm`); `backNeedsConfirm()` → `backConfirmRule({ scene: "initials", saved: this.doneEntry })`; `touchLayout(t)` → `initialsLayout(step, t.backPending)` with step from the scene state. While `TOUCH.active`, letters are drawn centered in the fixed cells (`INITIALS_CELLS[i] + INITIALS_CELL_W / 2`, y 130, align center), the underline spans the cursor cell, and the key-hint lines are not drawn (the "submit this name?" line stays).
- `play.ts`: `backNeedsConfirm()` → `backConfirmRule({ scene: "play", phase: this.phase })`; `touchLayout(t)` → `gameplayLayout("play", phase, { backPending, scored: lastResult === RoundEnd.SCORED, overlayLines })` where `overlayLines` = number of breakdown lines drawn (4, or 5 when the time multiplier line is shown). `render` draws the playfield (preview, map, popups, overlays) inside `withPlayfield`, then the bar. While `TOUCH.active` the bar is `drawHudBand(ctx, this.touchFrame.panels)` + `drawReadouts(ctx, this.touchFrame.readouts, values)` with values: angle `${Math.round(angle)}°` and power `${power}%` in WHITE, score `SCORE ${score zero-padded to 6}` in YELLOW, info `LV ${level}   LIVES ${lives or ∞}` followed by `   +${bonus}` while the running curvature bonus shows. Otherwise `withHudBar(ctx, () => drawHUD(...))` as before. The "[SPACE] continue" and game-over key hint lines are not drawn while `TOUCH.active`.
- `battle.ts`: `backNeedsConfirm()` → `backConfirmRule({ scene: "battle", phase: this.phase })`; `touchLayout(t)` → `gameplayLayout("battle", phase, { backPending })`. `render` draws the map, turn banner and overlays inside `withPlayfield`, then the bar. While `TOUCH.active` the bar is `drawHudBand(ctx, this.touchFrame.panels)` + readouts: angle, power (current player color), round_label "ROUND" (SILVER), round_value `${round}/${total}` (WHITE), p1/p2 name (with the ▶ arrow for the current player) and info `${dots} ${score}`, in the same player colors as today. Otherwise the keyboard HUD is drawn inside `withHudBar`, with its separator at the top of the bar. The match-end key hint is not drawn while `TOUCH.active`.
- `sandbox.ts`: `touchLayout(t)` → `gameplayLayout("training", phase, { backPending, previewOn, fieldOn })`. `render` draws the gravity field, preview, map, linger banner and the key-hint line inside `withPlayfield`, then the bar. While `TOUCH.active` the key-hint line is not drawn and the bar is `drawHudBand(ctx, this.touchFrame.panels)` + readouts: angle, power, level `L${map.level}`, all WHITE. Otherwise `withHudBar(ctx, () => drawHUD(...))` as before.

## 15. Browser wiring
### `src/touch/dom-input.ts`
```ts
export interface PointerHandlers {
  down(id: number, x: number, y: number): void;
  move(id: number, x: number, y: number): void;
  up(id: number, x: number, y: number): void;
  cancel(id: number): void;
  cancelAll(): void;
  deviceChanged(isTouch: boolean): void;
}
export function installTouchInput(canvas: HTMLCanvasElement, h: PointerHandlers): { isTouch(): boolean }
```
- Device: `matchMedia("(pointer: coarse)")` and `matchMedia("(hover: none)")` through `isTouchDevice`; on `change` of either query, re-evaluate and call `h.deviceChanged`.
- Coordinates: `canvas.getBoundingClientRect()` then `screenToLogical(e.clientX - r.left, e.clientY - r.top, r.width, r.height)`.
- `pointerdown` on the canvas: only on a touch device; `canvas.setPointerCapture(e.pointerId)`, `e.preventDefault()`, `h.down`. `pointermove` → `h.move`; `pointerup` → `h.up`; `pointercancel` → `h.cancel`. All gated on the touch device.
- `visibilitychange` to hidden and window `blur` → `h.cancelAll()`.
- On a touch device only: `contextmenu` (window) and `gesturestart` (document, Safari) get `preventDefault()`.

### `src/touch/dom-history.ts`
```ts
export function currentGuardIndex(): number   // history.state?.starballGuard ? history.state.index : 0
export function applyHistoryOps(ops: HistoryOp[]): void
  // push n: base = currentGuardIndex(); for i in 1..n: history.pushState({ starballGuard: true, index: base + i }, "")
  // go d: history.go(d)
export function onHistoryPop(handler: (isGuardEntry: boolean) => void): void
  // window "popstate": handler(Boolean(e.state && e.state.starballGuard))
```

### `index.html`
Add to the existing `html, body` rule: `touch-action: none; user-select: none; -webkit-user-select: none; -webkit-touch-callout: none; -webkit-tap-highlight-color: transparent; overscroll-behavior: none;` and a `canvas { touch-action: none; }` rule.

### `src/app.ts`
- Fields: `tracker = new PointerTracker()`, `layout: TouchLayout = EMPTY_LAYOUT`, `backConfirm = new BackConfirm()`, `backGuard = new BackGuard()`, `transform: RenderTransform`, `input` (from `installTouchInput`).
- `resize()`: `transform = renderTransform(innerWidth, innerHeight, devicePixelRatio || 1)`; canvas size from it. `render()`: `ctx.scale(transform.scaleX, transform.scaleY)`.
- Startup (after input install): `TOUCH.setDevice(input.isTouch())`; `applyHistoryOps(backGuard.setEnabled(TOUCH.device))`; `applyHistoryOps(backGuard.onLoad(currentGuardIndex()))`; `onHistoryPop(isGuard => { const r = backGuard.onPopState(now, isGuard); applyHistoryOps(r.ops); if (r.back) requestBack(); })`.
- `blocked()` = `TOUCH.device && isPortrait(innerWidth, innerHeight)`.
- `tick(now)`: if `TOUCH.active && !blocked()`, dispatch every emit from `tracker.tick(now, layout)`; `scene.update(dt)`; on scene change: `backConfirm.reset()`, `tracker.cancelAll()`, `applyHistoryOps(backGuard.onSceneChange(scene.isRoot))`; then `layout = TOUCH.active ? scene.touchLayout(context(now)) : EMPTY_LAYOUT`; `scene.touchFrame = layout`; render.
- `context(now)` = `{ backPending: backConfirm.pending(now), device: TOUCH.device }`.
- `render()`: after `scene.render(ctx)`: if `TOUCH.active` → `drawControls(ctx, layout, tracker.pressedIds())`; if `blocked()` → `drawRotatePrompt(ctx)`. Both inside the same scaled transform.
- `requestBack()`: `if (backConfirm.request(now, scene.backNeedsConfirm()) === "act") scene.handleEvent({ key: "Escape", shift: false })`.
- `emit(e)`: `dispatch(scene, e, { back: () => requestBack() })`.
- `keydown` (existing handler): first `const wasActive = TOUCH.active; TOUCH.onKey(); if (wasActive) tracker.cancelAll();`. If `blocked()` → `preventDefault` and return. If `TOUCH.device`: `applyHistoryOps(backGuard.onActivation())`; if `e.key === "Escape"`: `e.preventDefault()`, `const r = backGuard.onEscapeKey(now)`, `if (r.back) requestBack()`, return. Otherwise unchanged (blocked-keys set, `handleEvent`).
- Pointer handlers: `down`: `TOUCH.onPointer()`; `applyHistoryOps(backGuard.onActivation())`; if `blocked()` return; if the layout is empty because touch mode was just re-activated, recompute `layout = scene.touchLayout(context(now)); scene.touchFrame = layout`; then emit everything from `tracker.down(id, x, y, now, layout)`. `move` → `tracker.move`. `up` → emit everything from `tracker.up(id, x, y, layout)`. `cancel` → `tracker.cancel(id)`. `cancelAll` → `tracker.cancelAll()`. `deviceChanged(d)` → `TOUCH.setDevice(d)`; `applyHistoryOps(backGuard.setEnabled(d))`; `tracker.cancelAll()`.
- Keep the existing audio-unlock listeners.

## 16. Help CONTROLS page (touch devices only)
Title "TOUCH CONTROLS" (same style as the other page titles), subtitle "what each button does". Rows, label in YELLOW size 13 bold at x 40, text in PALE_CYAN size 11 at x 150, rows 30 px apart starting at y 76:
- MENUS — "tap an item to open it; ◀ ▶ change a setting"
- AIM — "↺ ↻ turn the launcher, − + change power"
- HOLD — "hold a button to repeat; keep holding for big steps"
- FIRE — "launch the shot; ABORT stops it in flight"
- PLAY — "RESET puts angle and power back"
- TRAINING — "NEW MAP, NEXT MAP, PREVIEW and FIELD"
- BACK — "during a run it asks QUIT? first; tap again to leave"
- SYSTEM — "the system back gesture works like BACK"

## 17. Scene tests isolation (`tests/touch/scenes.test.ts`)
- `vi.mock("../../src/api", () => ({ fetchRemoteScores: async () => null, submitRemoteScore: async () => null }))`.
- `beforeEach`: `resetStoreForTests()` (from `src/persistence.ts`), then `SETTINGS.load()`.
- Assert `globalThis.AudioContext` is undefined. Never call `render()` or `BANK.ensure()`.
- Play and Battle constructed with a fixed seed. Training: `vi.spyOn(Math, "random")` returning a fixed sequence.
- Async transitions: `await vi.waitFor(() => expect(scene.nextScene).not.toBeNull())`; compare `nextScene.constructor.name`.
- Read private fields through a typed cast, e.g. `(scene as unknown as { aim: AimState }).aim`.
