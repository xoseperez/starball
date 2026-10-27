import type { Color } from "../config";
import {
  BG_COLOR,
  DARK_GRAY,
  HUD_BG,
  HUD_H,
  LOGICAL_H,
  LOGICAL_W,
  PALE_CYAN,
  PLAYFIELD_H,
  ROYAL_BLUE,
  TOUCH_BUTTON,
  TOUCH_BUTTON_PRESSED,
  TOUCH_ON,
  TOUCH_ON_PRESSED,
  TOUCH_PANEL,
  TOUCH_PRIMARY,
  TOUCH_PRIMARY_PRESSED,
  TOUCH_TEXT,
  TOUCH_WARN,
  YELLOW,
} from "../config";
import { drawText } from "../render";
import { type Control, type Icon, type Rect, type Readout, type TouchLayout, isIcon } from "./controls";

export interface ReadoutValue {
  text: string;
  color?: Color;
}

const RADIUS = 6;

function rgba(c: Color, a = 1): string {
  return `rgba(${c[0]}, ${c[1]}, ${c[2]}, ${a})`;
}

function roundRect(ctx: CanvasRenderingContext2D, r: Rect): void {
  const rad = Math.min(RADIUS, r.w / 2, r.h / 2);
  ctx.beginPath();
  ctx.moveTo(r.x + rad, r.y);
  ctx.arcTo(r.x + r.w, r.y, r.x + r.w, r.y + r.h, rad);
  ctx.arcTo(r.x + r.w, r.y + r.h, r.x, r.y + r.h, rad);
  ctx.arcTo(r.x, r.y + r.h, r.x, r.y, rad);
  ctx.arcTo(r.x, r.y, r.x + r.w, r.y, rad);
  ctx.closePath();
}

function fillRound(ctx: CanvasRenderingContext2D, r: Rect, color: Color, alpha = 1): void {
  ctx.fillStyle = rgba(color, alpha);
  roundRect(ctx, r);
  ctx.fill();
}

export function drawHudBand(ctx: CanvasRenderingContext2D, panels: readonly Rect[] = []): void {
  ctx.fillStyle = rgba(HUD_BG);
  ctx.fillRect(0, PLAYFIELD_H, LOGICAL_W, HUD_H);
  ctx.strokeStyle = rgba(DARK_GRAY);
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, PLAYFIELD_H + 0.5);
  ctx.lineTo(LOGICAL_W, PLAYFIELD_H + 0.5);
  ctx.stroke();
  for (const panel of panels) {
    fillRound(ctx, panel, TOUCH_PANEL);
  }
}

export function drawControls(
  ctx: CanvasRenderingContext2D,
  layout: TouchLayout,
  pressed: ReadonlySet<string>,
): void {
  for (const control of layout.controls) {
    ctx.save();
    drawControl(ctx, control, pressed.has(control.id));
    ctx.restore();
  }
}

function fillFor(control: Control, isPressed: boolean): Color | null {
  if (control.style === "segment") return isPressed ? TOUCH_BUTTON_PRESSED : null;
  if (control.style === "primary") return isPressed ? TOUCH_PRIMARY_PRESSED : TOUCH_PRIMARY;
  if (control.lit === true) {
    if (control.id === "back") return isPressed ? TOUCH_PRIMARY_PRESSED : TOUCH_WARN;
    return isPressed ? TOUCH_ON_PRESSED : TOUCH_ON;
  }
  return isPressed ? TOUCH_BUTTON_PRESSED : TOUCH_BUTTON;
}

function drawControl(ctx: CanvasRenderingContext2D, control: Control, isPressed: boolean): void {
  const r = control.rect;
  if (control.style === "area") {
    if (isPressed) fillRound(ctx, r, ROYAL_BLUE, 0.35);
    return;
  }
  const fill = fillFor(control, isPressed);
  if (fill !== null) fillRound(ctx, r, fill);
  if (isIcon(control.label)) {
    drawIcon(ctx, control.label, r);
    return;
  }
  drawText(ctx, control.label, r.x + r.w / 2, r.y + r.h / 2, {
    size: control.style === "primary" ? 12 : 10,
    bold: true,
    color: TOUCH_TEXT,
    align: "center",
    baseline: "middle",
    maxWidth: r.w - 4,
  });
}

function filledTriangle(
  ctx: CanvasRenderingContext2D,
  x1: number, y1: number,
  x2: number, y2: number,
  x3: number, y3: number,
): void {
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.lineTo(x3, y3);
  ctx.closePath();
  ctx.fill();
}

function drawIcon(ctx: CanvasRenderingContext2D, icon: Icon, rect: Rect): void {
  const cx = rect.x + rect.w / 2;
  const cy = rect.y + rect.h / 2;
  const s = Math.min(rect.w, rect.h) * 0.5;
  const half = s / 2;
  ctx.fillStyle = rgba(TOUCH_TEXT);
  ctx.strokeStyle = rgba(TOUCH_TEXT);
  ctx.lineWidth = 2.5;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  switch (icon) {
    case "minus":
      ctx.beginPath();
      ctx.moveTo(cx - half, cy);
      ctx.lineTo(cx + half, cy);
      ctx.stroke();
      break;
    case "plus":
      ctx.beginPath();
      ctx.moveTo(cx - half, cy);
      ctx.lineTo(cx + half, cy);
      ctx.moveTo(cx, cy - half);
      ctx.lineTo(cx, cy + half);
      ctx.stroke();
      break;
    case "up":
      filledTriangle(ctx, cx, cy - half, cx + half, cy + half, cx - half, cy + half);
      break;
    case "down":
      filledTriangle(ctx, cx, cy + half, cx + half, cy - half, cx - half, cy - half);
      break;
    case "left":
      filledTriangle(ctx, cx - half, cy, cx + half, cy + half, cx + half, cy - half);
      break;
    case "right":
      filledTriangle(ctx, cx + half, cy, cx - half, cy + half, cx - half, cy - half);
      break;
    case "rot_ccw":
    case "rot_cw": {
      const ccw = icon === "rot_ccw";
      const r = s * 0.5;
      const start = -Math.PI / 2;
      const end = ccw ? start - 1.5 * Math.PI : start + 1.5 * Math.PI;
      ctx.beginPath();
      ctx.arc(cx, cy, r, start, end, ccw);
      ctx.stroke();
      const ex = cx + r * Math.cos(end);
      const ey = cy + r * Math.sin(end);
      const dx = ccw ? Math.sin(end) : -Math.sin(end);
      const dy = ccw ? -Math.cos(end) : Math.cos(end);
      const px = -dy;
      const py = dx;
      const len = s * 0.45;
      const halfW = s * 0.3;
      const bx = ex - dx * len * 0.4;
      const by = ey - dy * len * 0.4;
      filledTriangle(
        ctx,
        ex + dx * len * 0.6, ey + dy * len * 0.6,
        bx + px * halfW, by + py * halfW,
        bx - px * halfW, by - py * halfW,
      );
      break;
    }
  }
}

export function drawReadouts(
  ctx: CanvasRenderingContext2D,
  readouts: Readout[],
  values: Record<string, ReadoutValue | undefined>,
): void {
  for (const readout of readouts) {
    const value = values[readout.id];
    if (value === undefined) continue;
    const x =
      readout.align === "left"
        ? readout.rect.x
        : readout.align === "center"
          ? readout.rect.x + readout.rect.w / 2
          : readout.rect.x + readout.rect.w;
    const y = readout.rect.y + readout.rect.h / 2;
    drawText(ctx, value.text, x, y, {
      size: readout.size,
      bold: readout.bold,
      color: value.color ?? PALE_CYAN,
      align: readout.align,
      baseline: "middle",
      maxWidth: readout.rect.w,
    });
  }
}

export function drawRotatePrompt(ctx: CanvasRenderingContext2D): void {
  ctx.fillStyle = rgba(BG_COLOR);
  ctx.fillRect(0, 0, LOGICAL_W, LOGICAL_H);
  drawText(ctx, "ROTATE TO LANDSCAPE", LOGICAL_W / 2, 160, {
    size: 20,
    bold: true,
    color: YELLOW,
    align: "center",
    baseline: "middle",
  });
  drawText(ctx, "Starball plays in landscape", LOGICAL_W / 2, 196, {
    size: 12,
    color: PALE_CYAN,
    align: "center",
    baseline: "middle",
  });
}
