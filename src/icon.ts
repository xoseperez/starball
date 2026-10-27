import { BG_COLOR, BLACK, PALETTE, SILVER, WHITE, type Color } from "./config";

export interface IconFile {
  file: string;
  size: number;
  rounded: boolean;
  purpose?: "any" | "maskable";
}

export const ICON_FILES: readonly IconFile[] = [
  { file: "icon-192.png", size: 192, rounded: true, purpose: "any" },
  { file: "icon-512.png", size: 512, rounded: true, purpose: "any" },
  { file: "icon-maskable-512.png", size: 512, rounded: false, purpose: "maskable" },
  { file: "apple-touch-icon.png", size: 180, rounded: false },
];

export const MANIFEST_FILE = "manifest.webmanifest";

type Shape =
  | { kind: "disc"; x: number; y: number; r: number; color: Color; alpha: number }
  | { kind: "ring"; x: number; y: number; r: number; w: number; color: Color; alpha: number }
  | { kind: "segment"; ax: number; ay: number; bx: number; by: number; w: number; color: Color; alpha: number };

interface Point {
  x: number;
  y: number;
}

const STAR = { x: 0.44, y: 0.62, r: 0.17 };
const GOAL = { x: 0.72, y: 0.32 };
const PATH: readonly Point[] = [
  { x: 0.2, y: 0.76 },
  { x: 0.16, y: 0.34 },
  { x: 0.4, y: 0.2 },
  { x: GOAL.x, y: GOAL.y },
];
const ASTEROID_AT = 0.6;
const CORNER = 0.2;

export function hexColor(c: Color): string {
  return `#${c.map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}

function disc(x: number, y: number, r: number, color: Color, alpha = 1): Shape {
  return { kind: "disc", x, y, r, color, alpha };
}

function ring(x: number, y: number, r: number, w: number, color: Color, alpha = 1): Shape {
  return { kind: "ring", x, y, r, w, color, alpha };
}

function bezier(t: number): Point {
  const [p0, p1, p2, p3] = PATH;
  const u = 1 - t;
  const a = u * u * u;
  const b = 3 * u * u * t;
  const c = 3 * u * t * t;
  const d = t * t * t;
  return { x: a * p0.x + b * p1.x + c * p2.x + d * p3.x, y: a * p0.y + b * p1.y + c * p2.y + d * p3.y };
}

function pathSamples(n: number): { points: Point[]; lengths: number[] } {
  const points: Point[] = [];
  const lengths: number[] = [];
  let total = 0;
  for (let i = 0; i <= n; i++) {
    const p = bezier(i / n);
    if (i > 0) total += Math.hypot(p.x - points[i - 1].x, p.y - points[i - 1].y);
    points.push(p);
    lengths.push(total);
  }
  return { points, lengths };
}

function pointAtLength(samples: { points: Point[]; lengths: number[] }, s: number): Point {
  const { points, lengths } = samples;
  let i = 1;
  while (i < lengths.length - 1 && lengths[i] < s) i++;
  const span = lengths[i] - lengths[i - 1];
  const f = span > 0 ? (s - lengths[i - 1]) / span : 0;
  return { x: points[i - 1].x + (points[i].x - points[i - 1].x) * f, y: points[i - 1].y + (points[i].y - points[i - 1].y) * f };
}

function scene(): Shape[] {
  const shapes: Shape[] = [];

  for (const [x, y, r] of [
    [0.16, 0.16, 0.008],
    [0.88, 0.58, 0.009],
    [0.6, 0.88, 0.006],
    [0.84, 0.84, 0.007],
    [0.56, 0.1, 0.006],
    [0.07, 0.42, 0.006],
  ]) {
    shapes.push(disc(x, y, r, PALETTE[20], 0.7));
  }

  const { x: sx, y: sy, r } = STAR;
  shapes.push(disc(sx, sy, r + 0.045, PALETTE[5], 0.2), disc(sx, sy, r + 0.022, PALETTE[27], 0.27));
  for (const [offset, color] of [
    [0, PALETTE[27]],
    [0.14, PALETTE[28]],
    [0.29, PALETTE[5]],
    [0.5, PALETTE[7]],
  ] as const) {
    shapes.push(disc(sx, sy, r * (1 - offset), color));
  }
  shapes.push(ring(sx, sy, r, 0.005, BLACK));

  const samples = pathSamples(400);
  const total = samples.lengths[samples.lengths.length - 1];
  const asteroid = ASTEROID_AT * total;

  const dash = 0.045;
  const gap = 0.03;
  const trailEnd = asteroid - 0.055;
  const trailStart = 0.08 * total;
  for (let s = trailEnd; s - dash > trailStart; s -= dash + gap) {
    const a = pointAtLength(samples, s - dash);
    const b = pointAtLength(samples, s);
    const alpha = 0.5 + 0.5 * ((s - trailStart) / (trailEnd - trailStart));
    shapes.push({ kind: "segment", ax: a.x, ay: a.y, bx: b.x, by: b.y, w: 0.017, color: PALETTE[8], alpha });
  }

  for (let s = asteroid + 0.07; s < total - 0.1; s += 0.04) {
    const p = pointAtLength(samples, s);
    shapes.push(disc(p.x, p.y, 0.008, SILVER, 0.9));
  }

  shapes.push(
    ring(GOAL.x, GOAL.y, 0.085, 0.011, PALETTE[16]),
    ring(GOAL.x, GOAL.y, 0.068, 0.011, PALETTE[18]),
    ring(GOAL.x, GOAL.y, 0.051, 0.011, PALETTE[20]),
    disc(GOAL.x, GOAL.y, 0.012, WHITE),
  );

  const p = pointAtLength(samples, asteroid);
  shapes.push(
    disc(p.x, p.y, 0.039, BLACK),
    disc(p.x, p.y, 0.036, PALETTE[24]),
    disc(p.x, p.y, 0.024, PALETTE[22]),
    disc(p.x - 0.012, p.y - 0.012, 0.011, WHITE),
  );

  return shapes;
}

function distance(shape: Shape, x: number, y: number): number {
  switch (shape.kind) {
    case "disc":
      return Math.hypot(x - shape.x, y - shape.y) - shape.r;
    case "ring":
      return Math.abs(Math.hypot(x - shape.x, y - shape.y) - shape.r) - shape.w / 2;
    case "segment": {
      const dx = shape.bx - shape.ax;
      const dy = shape.by - shape.ay;
      const len2 = dx * dx + dy * dy;
      const t = len2 > 0 ? Math.max(0, Math.min(1, ((x - shape.ax) * dx + (y - shape.ay) * dy) / len2)) : 0;
      return Math.hypot(x - (shape.ax + dx * t), y - (shape.ay + dy * t)) - shape.w / 2;
    }
  }
}

function extent(shape: Shape): { x0: number; y0: number; x1: number; y1: number } {
  switch (shape.kind) {
    case "disc":
      return { x0: shape.x - shape.r, y0: shape.y - shape.r, x1: shape.x + shape.r, y1: shape.y + shape.r };
    case "ring": {
      const o = shape.r + shape.w / 2;
      return { x0: shape.x - o, y0: shape.y - o, x1: shape.x + o, y1: shape.y + o };
    }
    case "segment": {
      const h = shape.w / 2;
      return {
        x0: Math.min(shape.ax, shape.bx) - h,
        y0: Math.min(shape.ay, shape.by) - h,
        x1: Math.max(shape.ax, shape.bx) + h,
        y1: Math.max(shape.ay, shape.by) + h,
      };
    }
  }
}

function coverage(d: number, size: number): number {
  return Math.max(0, Math.min(1, 0.5 - d * size));
}

function roundedSquare(x: number, y: number): number {
  const qx = Math.abs(x - 0.5) - (0.5 - CORNER);
  const qy = Math.abs(y - 0.5) - (0.5 - CORNER);
  return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - CORNER;
}

export function renderIcon(size: number, rounded: boolean): Uint8Array {
  const rgb = new Float32Array(size * size * 3);
  for (let i = 0; i < size * size; i++) {
    rgb[i * 3] = BG_COLOR[0];
    rgb[i * 3 + 1] = BG_COLOR[1];
    rgb[i * 3 + 2] = BG_COLOR[2];
  }

  for (const shape of scene()) {
    const box = extent(shape);
    const px0 = Math.max(0, Math.floor(box.x0 * size) - 1);
    const py0 = Math.max(0, Math.floor(box.y0 * size) - 1);
    const px1 = Math.min(size - 1, Math.ceil(box.x1 * size) + 1);
    const py1 = Math.min(size - 1, Math.ceil(box.y1 * size) + 1);
    for (let py = py0; py <= py1; py++) {
      for (let px = px0; px <= px1; px++) {
        const a = coverage(distance(shape, (px + 0.5) / size, (py + 0.5) / size), size) * shape.alpha;
        if (a <= 0) continue;
        const i = (py * size + px) * 3;
        rgb[i] += (shape.color[0] - rgb[i]) * a;
        rgb[i + 1] += (shape.color[1] - rgb[i + 1]) * a;
        rgb[i + 2] += (shape.color[2] - rgb[i + 2]) * a;
      }
    }
  }

  const out = new Uint8Array(size * size * 4);
  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      const i = py * size + px;
      out[i * 4] = Math.round(rgb[i * 3]);
      out[i * 4 + 1] = Math.round(rgb[i * 3 + 1]);
      out[i * 4 + 2] = Math.round(rgb[i * 3 + 2]);
      const alpha = rounded ? coverage(roundedSquare((px + 0.5) / size, (py + 0.5) / size), size) : 1;
      out[i * 4 + 3] = Math.round(alpha * 255);
    }
  }
  return out;
}

export function webManifest(): Record<string, unknown> {
  const color = hexColor(BG_COLOR);
  return {
    name: "Starball",
    short_name: "Starball",
    description: "A gravity puzzle arcade game",
    start_url: "./",
    scope: "./",
    display: "standalone",
    orientation: "landscape",
    background_color: color,
    theme_color: color,
    icons: ICON_FILES.filter((f) => f.purpose !== undefined).map((f) => ({
      src: f.file,
      sizes: `${f.size}x${f.size}`,
      type: "image/png",
      purpose: f.purpose,
    })),
  };
}
