// Procedurally-generated pixel-art sprites in the DawnBringer 32 palette.
// Each sprite is rendered into a small HTMLCanvasElement once at first use
// and cached. Mirrors src/starball/sprites.py.

import * as config from "./config";
import type { Color, StarType } from "./config";

type Layer = readonly [number, Color]; // [radius_offset, color]

const cache: Partial<Record<string, HTMLCanvasElement>> = {};

function makeSurface(size: number): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  ctx.imageSmoothingEnabled = false;
  return { canvas, ctx };
}

function cssColor(c: Color, alpha = 1): string {
  return `rgba(${c[0]}, ${c[1]}, ${c[2]}, ${alpha})`;
}

function fillCircle(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, c: Color, alpha = 1): void {
  ctx.fillStyle = cssColor(c, alpha);
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
}

function strokeCircle(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, c: Color, alpha = 1, w = 1): void {
  ctx.strokeStyle = cssColor(c, alpha);
  ctx.lineWidth = w;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.stroke();
}

function shadedDisc(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
  layers: readonly Layer[],
  outline: Color | null = config.BLACK,
): void {
  for (const [offset, color] of layers) {
    fillCircle(ctx, cx, cy, Math.max(1, r - offset), color);
  }
  if (outline) strokeCircle(ctx, cx, cy, r, outline);
}

function addHighlight(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, c: Color): void {
  const hx = cx - Math.max(1, Math.floor(r / 3));
  const hy = cy - Math.max(1, Math.floor(r / 3));
  const hr = Math.max(1, Math.floor(r / 4));
  fillCircle(ctx, hx, hy, hr, c);
}

// ---------------------------------------------------------------------------
// Star sprites
// ---------------------------------------------------------------------------

function makeBrownDwarf(r: number): HTMLCanvasElement {
  const { canvas, ctx } = makeSurface(r * 2 + 4);
  const c = canvas.width / 2;
  shadedDisc(ctx, c, c, r, [
    [0, config.PALETTE[3]],
    [1, config.PALETTE[4]],
    [3, config.PALETTE[6]],
  ]);
  return canvas;
}

function makeStandardStar(r: number): HTMLCanvasElement {
  const { canvas, ctx } = makeSurface(r * 2 + 6);
  const c = canvas.width / 2;
  shadedDisc(ctx, c, c, r, [
    [0, config.PALETTE[5]],
    [1, config.PALETTE[8]],
    [3, config.PALETTE[7]],
  ]);
  addHighlight(ctx, c, c, r, config.WHITE);
  return canvas;
}

function makeBlueGiant(r: number): HTMLCanvasElement {
  const { canvas, ctx } = makeSurface(r * 2 + 12);
  const c = canvas.width / 2;
  // Outer halo
  fillCircle(ctx, c, c, r + 5, config.PALETTE[18], 0.24);
  fillCircle(ctx, c, c, r + 3, config.PALETTE[19], 0.31);
  shadedDisc(ctx, c, c, r, [
    [0, config.PALETTE[16]],
    [1, config.PALETTE[17]],
    [3, config.PALETTE[18]],
    [5, config.PALETTE[20]],
  ]);
  addHighlight(ctx, c, c, r, config.WHITE);
  return canvas;
}

function makeRedGiant(r: number): HTMLCanvasElement {
  const { canvas, ctx } = makeSurface(r * 2 + 12);
  const c = canvas.width / 2;
  // Soft halo
  fillCircle(ctx, c, c, r + 4, config.PALETTE[5], 0.2);
  fillCircle(ctx, c, c, r + 2, config.PALETTE[27], 0.27);
  shadedDisc(ctx, c, c, r, [
    [0, config.PALETTE[27]],
    [2, config.PALETTE[28]],
    [4, config.PALETTE[5]],
    [7, config.PALETTE[7]],
  ]);
  return canvas;
}

// Black hole has a fixed capture radius and visible disc; the optional
// radius arg is accepted for signature uniformity but ignored.
function makeBlackHole(_r: number): HTMLCanvasElement {
  const p = config.STAR_TYPES.black_hole;
  const rVis = p.radius;
  const rCap = p.captureRadius!;
  const size = rCap * 2 + 8;
  const { canvas, ctx } = makeSurface(size);
  const c = canvas.width / 2;

  // Accretion ring (purple → pink, fading outward)
  for (let i = 0; i < 4; i++) {
    const col = i < 2 ? config.PALETTE[26] : config.PALETTE[29];
    const alpha = (80 - i * 20) / 255;
    strokeCircle(ctx, c, c, rCap + 2 - i, col, alpha, 1);
  }

  // Capture-radius dashed warning ring (purple dots every 18°)
  ctx.fillStyle = cssColor(config.PURPLE);
  for (let deg = 0; deg < 360; deg += 18) {
    const rad = (deg * Math.PI) / 180;
    const x = c + rCap * Math.cos(rad);
    const y = c + rCap * Math.sin(rad);
    ctx.fillRect(Math.round(x), Math.round(y), 1, 1);
  }

  // Event horizon — pitch black disc with subtle dark-gray rim
  fillCircle(ctx, c, c, rVis, config.BLACK);
  strokeCircle(ctx, c, c, rVis, config.PALETTE[24]);

  return canvas;
}

const STAR_FACTORIES: Record<StarType, (r: number) => HTMLCanvasElement> = {
  brown_dwarf: makeBrownDwarf,
  standard: makeStandardStar,
  blue_giant: makeBlueGiant,
  red_giant: makeRedGiant,
  black_hole: makeBlackHole,
};

export function getStarSprite(starType: StarType, radius?: number): HTMLCanvasElement {
  const r = Math.round(radius ?? config.STAR_TYPES[starType].radius);
  const key = `star:${starType}:${r}`;
  if (!cache[key]) cache[key] = STAR_FACTORIES[starType](r);
  return cache[key]!;
}

// ---------------------------------------------------------------------------
// Asteroid / launcher / goal
// ---------------------------------------------------------------------------

export function getAsteroidSprite(): HTMLCanvasElement {
  const key = "asteroid";
  if (cache[key]) return cache[key]!;
  const { canvas, ctx } = makeSurface(8);
  fillCircle(ctx, 4, 4, 3, config.PALETTE[24]);
  fillCircle(ctx, 4, 4, 2, config.PALETTE[22]);
  fillCircle(ctx, 3, 3, 1, config.WHITE);
  cache[key] = canvas;
  return canvas;
}

export function getLauncherSprite(): HTMLCanvasElement {
  const key = "launcher";
  if (cache[key]) return cache[key]!;
  const { canvas, ctx } = makeSurface(12);
  // Body
  ctx.fillStyle = cssColor(config.PALETTE[22]);
  ctx.fillRect(2, 4, 8, 8);
  ctx.strokeStyle = cssColor(config.BLACK);
  ctx.lineWidth = 1;
  ctx.strokeRect(2.5, 4.5, 7, 7);
  // Top dome
  fillCircle(ctx, 6, 4, 2, config.SILVER);
  strokeCircle(ctx, 6, 4, 2, config.BLACK);
  cache[key] = canvas;
  return canvas;
}

export function getGoalSprite(): HTMLCanvasElement {
  const key = "goal";
  if (cache[key]) return cache[key]!;
  const size = 32;
  const { canvas, ctx } = makeSurface(size);
  const c = size / 2;
  strokeCircle(ctx, c, c, 12, config.PALETTE[16]);
  strokeCircle(ctx, c, c, 10, config.PALETTE[18]);
  strokeCircle(ctx, c, c, 8, config.PALETTE[20]);
  fillCircle(ctx, c, c, 1, config.WHITE);
  cache[key] = canvas;
  return canvas;
}
