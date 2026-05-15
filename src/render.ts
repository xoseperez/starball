// Drawing primitives: HUD, playfield, sprites with overlays. The "logical"
// canvas is 640×360; everything is drawn here and the App scales it up to
// fit the host window.

import * as config from "./config";
import type { Color } from "./config";
import {
  type Asteroid,
  type GameMap,
  type Goal,
  type Launcher,
  type Star,
  starRadius,
} from "./entities";
import { acceleration } from "./physics";
import {
  getAsteroidSprite,
  getGoalSprite,
  getLauncherSprite,
  getStarSprite,
} from "./sprites";

// ---------------------------------------------------------------------------
// Color helpers
// ---------------------------------------------------------------------------

function cssColor(c: Color, alpha = 1): string {
  return `rgba(${c[0]}, ${c[1]}, ${c[2]}, ${alpha})`;
}

// ---------------------------------------------------------------------------
// Text
// ---------------------------------------------------------------------------

export interface TextOpts {
  size?: number;
  bold?: boolean;
  color?: Color;
  align?: CanvasTextAlign;
  baseline?: CanvasTextBaseline;
  shadow?: boolean;
}

export function drawText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  opts: TextOpts = {},
): void {
  const size = opts.size ?? 14;
  const bold = opts.bold ?? false;
  const color = opts.color ?? config.WHITE;
  ctx.font = `${bold ? "bold " : ""}${size}px ui-monospace, "SF Mono", Menlo, Consolas, monospace`;
  ctx.textAlign = opts.align ?? "left";
  ctx.textBaseline = opts.baseline ?? "top";
  if (opts.shadow) {
    ctx.fillStyle = cssColor(config.BLACK);
    ctx.fillText(text, x + 1, y + 1);
  }
  ctx.fillStyle = cssColor(color);
  ctx.fillText(text, x, y);
}

export function textWidth(ctx: CanvasRenderingContext2D, text: string, size: number, bold = false): number {
  ctx.font = `${bold ? "bold " : ""}${size}px ui-monospace, "SF Mono", Menlo, Consolas, monospace`;
  return ctx.measureText(text).width;
}

// ---------------------------------------------------------------------------
// Trail (asteroid path particles)
// ---------------------------------------------------------------------------

export class Trail {
  points: Array<[number, number]> = [];
  constructor(public length = 64) {}

  push(x: number, y: number): void {
    this.points.push([x, y]);
    if (this.points.length > this.length) {
      this.points.shift();
    }
  }

  clear(): void {
    this.points = [];
  }

  draw(ctx: CanvasRenderingContext2D): void {
    const n = this.points.length;
    if (n === 0) return;
    const bg = config.BG_COLOR;
    const fg = config.PALE_CYAN;
    for (let i = 0; i < n; i++) {
      const [x, y] = this.points[i];
      const alpha = (i + 1) / n;
      const r = Math.round(fg[0] * alpha + bg[0] * (1 - alpha));
      const g = Math.round(fg[1] * alpha + bg[1] * (1 - alpha));
      const b = Math.round(fg[2] * alpha + bg[2] * (1 - alpha));
      ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
      ctx.fillRect(Math.floor(x), Math.floor(y), 1, 1);
    }
  }
}

// ---------------------------------------------------------------------------
// Stars / goal / launcher / asteroid
// ---------------------------------------------------------------------------

export function drawStar(ctx: CanvasRenderingContext2D, s: Star): void {
  const sprite = getStarSprite(s.starType, starRadius(s));
  const half = sprite.width / 2;
  ctx.drawImage(sprite, Math.round(s.x - half), Math.round(s.y - half));
}

export function drawGoal(ctx: CanvasRenderingContext2D, g: Goal, pulsePhase: number): void {
  const sprite = getGoalSprite();
  const half = sprite.width / 2;
  ctx.drawImage(sprite, Math.round(g.x - half), Math.round(g.y - half));
  const pulse = Math.round(2 * Math.sin(pulsePhase * 2 * Math.PI));
  ctx.strokeStyle = cssColor(config.PALE_CYAN);
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(g.x, g.y, g.radius + pulse, 0, Math.PI * 2);
  ctx.stroke();
}

export function drawLauncher(
  ctx: CanvasRenderingContext2D,
  launcher: Launcher,
  color: Color | null = null,
): void {
  const aimColor = color ?? config.YELLOW;
  const sprite = getLauncherSprite();
  const half = sprite.width / 2;
  ctx.drawImage(sprite, Math.round(launcher.x - half), Math.round(launcher.y - half));

  const cx = launcher.x;
  const cy = launcher.y;
  const angleRad = (launcher.angleDeg * Math.PI) / 180;
  const pct = Math.max(10, Math.min(100, launcher.powerPct));
  const aimLen = 16 + ((pct - 10) * (60 - 16)) / 90;
  const tx = cx + Math.cos(angleRad) * aimLen;
  const ty = cy - Math.sin(angleRad) * aimLen;

  // Dashed line
  ctx.strokeStyle = cssColor(aimColor);
  ctx.lineWidth = 1;
  const dashes = 8;
  for (let i = 0; i < dashes; i++) {
    if (i % 2 !== 0) continue;
    const t0 = i / dashes;
    const t1 = (i + 1) / dashes;
    const x0 = cx + (tx - cx) * t0;
    const y0 = cy + (ty - cy) * t0;
    const x1 = cx + (tx - cx) * t1;
    const y1 = cy + (ty - cy) * t1;
    ctx.beginPath();
    ctx.moveTo(Math.floor(x0) + 0.5, Math.floor(y0) + 0.5);
    ctx.lineTo(Math.floor(x1) + 0.5, Math.floor(y1) + 0.5);
    ctx.stroke();
  }
  // Arrowhead
  ctx.fillStyle = cssColor(aimColor);
  ctx.beginPath();
  ctx.arc(tx, ty, 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = cssColor(config.WHITE);
  ctx.beginPath();
  ctx.arc(tx, ty, 1, 0, Math.PI * 2);
  ctx.fill();
}

export function drawAsteroid(ctx: CanvasRenderingContext2D, a: Asteroid): void {
  if (!a.alive) return;
  const sprite = getAsteroidSprite();
  const half = sprite.width / 2;
  ctx.drawImage(sprite, Math.round(a.x - half), Math.round(a.y - half));
}

// ---------------------------------------------------------------------------
// HUD band
// ---------------------------------------------------------------------------

export interface HUDOpts {
  title: string;
  angleDeg: number;
  powerPct: number;
  score: number;
  lives: number | null;
  level: number | null;
  extra?: string;
}

export function drawHUD(ctx: CanvasRenderingContext2D, opts: HUDOpts): void {
  ctx.fillStyle = cssColor(config.HUD_BG);
  ctx.fillRect(0, 0, config.LOGICAL_W, config.HUD_H);
  ctx.strokeStyle = cssColor(config.DARK_GRAY);
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, config.HUD_H - 0.5);
  ctx.lineTo(config.LOGICAL_W, config.HUD_H - 0.5);
  ctx.stroke();

  // Left: title + angle/power
  drawText(ctx, opts.title, 6, 4, { size: 14, bold: true, color: config.WHITE });
  const aim = `ANG ${Math.round(opts.angleDeg).toString().padStart(3)}°  PWR ${opts.powerPct.toString().padStart(3)}%`;
  drawText(ctx, aim, 6, 22, { size: 12, color: config.PALE_CYAN });

  // Right: SCORE, LIVES, LEVEL, EXTRA
  const rightX = config.LOGICAL_W - 6;
  const scoreStr = `SCORE ${opts.score.toString().padStart(6)}`;
  drawText(ctx, scoreStr, rightX, 4, {
    size: 14,
    bold: true,
    color: config.YELLOW,
    align: "right",
  });

  const infoParts: string[] = [];
  if (opts.level !== null) infoParts.push(`LV ${opts.level}`);
  if (opts.lives !== null) infoParts.push(opts.lives >= 0 ? `LIVES ${opts.lives}` : "LIVES ∞");
  if (opts.extra) infoParts.push(opts.extra);
  if (infoParts.length) {
    drawText(ctx, infoParts.join("   "), rightX, 22, {
      size: 12,
      color: config.PALE_CYAN,
      align: "right",
    });
  }
}

// ---------------------------------------------------------------------------
// Full-map render (excluding HUD)
// ---------------------------------------------------------------------------

export interface DrawMapOpts {
  asteroid: Asteroid | null;
  trail: Trail | null;
  pulsePhase: number;
  launcherColor?: Color | null;
}

export function drawMap(
  ctx: CanvasRenderingContext2D,
  m: GameMap,
  opts: DrawMapOpts,
): void {
  drawPlayfieldBorder(ctx);
  if (opts.trail) opts.trail.draw(ctx);
  for (const s of m.stars) drawStar(ctx, s);
  drawGoal(ctx, m.goal, opts.pulsePhase);
  drawLauncher(ctx, m.launcher, opts.launcherColor ?? null);
  if (opts.asteroid && opts.asteroid.alive) drawAsteroid(ctx, opts.asteroid);
}

// ---------------------------------------------------------------------------
// Gravity-field heatmap (sandbox-only debug viz)
// ---------------------------------------------------------------------------
//
// Samples |acceleration| on a coarse grid over the playfield and renders a
// stepped color heatmap (log-scaled magnitude → 5-step ramp). The field is a
// pure function of the star set, so the rasterized tile is cached and reused
// every frame until the star list identity changes.

const GRAVITY_CELL = 8;
const GRAVITY_LOG_MIN = 1.5;     // log10(accel) below this is invisible
const GRAVITY_LOG_MAX = 4.5;     // log10(accel) above this is saturated
const GRAVITY_RAMP: ReadonlyArray<Color> = [
  [40, 60, 110],   // very faint blue
  [60, 110, 180],  // blue
  [80, 200, 200],  // cyan
  [240, 200, 80],  // yellow
  [220, 80, 60],   // red
];

let gravityCache: { stars: readonly Star[]; canvas: HTMLCanvasElement } | null = null;

function renderGravityField(stars: readonly Star[]): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = config.LOGICAL_W;
  canvas.height = config.PLAYFIELD_H;
  const c = canvas.getContext("2d")!;
  c.imageSmoothingEnabled = false;
  if (stars.length === 0) return canvas;

  const cols = Math.ceil(config.LOGICAL_W / GRAVITY_CELL);
  const rows = Math.ceil(config.PLAYFIELD_H / GRAVITY_CELL);
  const logSpan = GRAVITY_LOG_MAX - GRAVITY_LOG_MIN;
  const lastBand = GRAVITY_RAMP.length - 1;

  for (let cy = 0; cy < rows; cy++) {
    for (let cx = 0; cx < cols; cx++) {
      // Sample at cell center, in playfield coords.
      const x = cx * GRAVITY_CELL + GRAVITY_CELL / 2;
      const y = cy * GRAVITY_CELL + GRAVITY_CELL / 2 + config.HUD_H;
      const [ax, ay] = acceleration(x, y, stars);
      const mag = Math.hypot(ax, ay);
      if (mag <= 0) continue;
      const t = (Math.log10(mag) - GRAVITY_LOG_MIN) / logSpan;
      if (t <= 0) continue;
      const band = Math.min(lastBand, Math.floor(t * GRAVITY_RAMP.length));
      const col = GRAVITY_RAMP[band];
      c.fillStyle = `rgba(${col[0]}, ${col[1]}, ${col[2]}, 0.55)`;
      c.fillRect(cx * GRAVITY_CELL, cy * GRAVITY_CELL, GRAVITY_CELL, GRAVITY_CELL);
    }
  }
  return canvas;
}

export function drawGravityField(ctx: CanvasRenderingContext2D, stars: readonly Star[]): void {
  if (gravityCache === null || gravityCache.stars !== stars) {
    gravityCache = { stars, canvas: renderGravityField(stars) };
  }
  ctx.drawImage(gravityCache.canvas, 0, config.HUD_H);
}

/** A 1-px border around the playfield rect so its edges are obvious. */
export function drawPlayfieldBorder(ctx: CanvasRenderingContext2D): void {
  ctx.strokeStyle = cssColor(config.DARK_GRAY);
  ctx.lineWidth = 1;
  // 0.5 offsets keep the 1-px line crisp on pixel boundaries.
  ctx.strokeRect(0.5, config.HUD_H + 0.5, config.LOGICAL_W - 1, config.PLAYFIELD_H - 1);
}
