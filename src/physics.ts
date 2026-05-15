// Velocity-Verlet integration, Plummer-softened gravity, blue-giant repulsion,
// black-hole capped pull, wall bounce, adaptive substepping, and swept
// collision detection. All quantities in logical px and seconds.

import * as config from "./config";
import {
  type Asteroid,
  type Goal,
  type Star,
  newAsteroid,
  starCaptureRadius,
  starRadius,
  starSoftening,
} from "./entities";

export enum RoundEnd {
  NONE = "none",
  SCORED = "scored",
  CRASHED = "crashed",
  EXITED = "exited",
  STOPPED = "stopped",
  NO_PROGRESS = "no_progress",
  HARD_TIMEOUT = "hard_timeout",
  ABORTED = "aborted",
}

export interface StepResult {
  end: RoundEnd;
  crashedInto: Star | null;
  bounced: boolean;
}

function newStepResult(): StepResult {
  return { end: RoundEnd.NONE, crashedInto: null, bounced: false };
}

// ---------------------------------------------------------------------------
// Force computation
// ---------------------------------------------------------------------------

export function acceleration(
  x: number,
  y: number,
  stars: readonly Star[],
): [number, number] {
  let axTot = 0;
  let ayTot = 0;
  for (const s of stars) {
    const dx = s.x - x;
    const dy = s.y - y;
    const r2 = dx * dx + dy * dy;
    if (r2 === 0) continue;
    const r = Math.sqrt(r2);
    const p = config.STAR_TYPES[s.starType];

    if (p.forceModel === "capped_pull") {
      const RCap = p.captureRadius!;
      const aMax = p.aMax!;
      const mag = aMax * (RCap / Math.max(r, RCap));
      const invR = 1 / r;
      axTot += mag * dx * invR;
      ayTot += mag * dy * invR;
    } else {
      // Plummer-softened Newtonian
      const eps = starSoftening(s);
      const denom = Math.pow(r2 + eps * eps, 1.5);
      const coeff = (config.G_GRAV * p.mass) / denom;
      axTot += coeff * dx;
      ayTot += coeff * dy;

      if (p.forceModel === "newtonian_with_repulsion") {
        const repRadius = starRadius(s) * (p.repulsionRadiusMult ?? 2);
        if (r < repRadius) {
          const kRep = p.repulsionK ?? 0;
          const repDenom = r2 * r;
          const repCoeff = (kRep * p.mass) / repDenom;
          axTot -= repCoeff * dx;
          ayTot -= repCoeff * dy;
        }
      }
    }
  }
  return [axTot, ayTot];
}

// ---------------------------------------------------------------------------
// Adaptive substep count per render frame
// ---------------------------------------------------------------------------

export function substepsForFrame(a: Asteroid, stars: readonly Star[]): number {
  const base = Math.max(1, Math.round(config.PHYSICS_HZ / config.TARGET_FPS));
  let multiplier = 1;
  for (const s of stars) {
    const dx = s.x - a.x;
    const dy = s.y - a.y;
    const r = Math.hypot(dx, dy);
    const ref = starCaptureRadius(s);
    if (r < 1.5 * ref) {
      multiplier = Math.max(multiplier, 4);
    } else if (r < 3.0 * ref) {
      multiplier = Math.max(multiplier, 2);
    }
  }
  return base * multiplier;
}

// ---------------------------------------------------------------------------
// Swept collision: segment vs circle
// ---------------------------------------------------------------------------

export function segmentCircleHit(
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  cx: number,
  cy: number,
  r: number,
): boolean {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const fx = x0 - cx;
  const fy = y0 - cy;
  const a = dx * dx + dy * dy;
  if (a === 0) return fx * fx + fy * fy <= r * r;
  const b = 2 * (fx * dx + fy * dy);
  const c = fx * fx + fy * fy - r * r;
  const disc = b * b - 4 * a * c;
  if (disc < 0) return false;
  const sqrtD = Math.sqrt(disc);
  const t1 = (-b - sqrtD) / (2 * a);
  const t2 = (-b + sqrtD) / (2 * a);
  return (
    (t1 >= 0 && t1 <= 1) ||
    (t2 >= 0 && t2 <= 1) ||
    (t1 < 0 && t2 > 1)
  );
}

// ---------------------------------------------------------------------------
// Wall bounce
// ---------------------------------------------------------------------------

function bounceWalls(a: Asteroid): boolean {
  let bounced = false;
  const left = 0;
  const right = config.LOGICAL_W;
  const top = config.HUD_H;
  const bottom = config.LOGICAL_H;

  if (a.x < left) {
    a.x = left + (left - a.x);
    a.vx = -a.vx * config.WALL_DAMPING;
    bounced = true;
  } else if (a.x > right) {
    a.x = right - (a.x - right);
    a.vx = -a.vx * config.WALL_DAMPING;
    bounced = true;
  }

  if (a.y < top) {
    a.y = top + (top - a.y);
    a.vy = -a.vy * config.WALL_DAMPING;
    bounced = true;
  } else if (a.y > bottom) {
    a.y = bottom - (a.y - bottom);
    a.vy = -a.vy * config.WALL_DAMPING;
    bounced = true;
  }
  return bounced;
}

// ---------------------------------------------------------------------------
// One physics substep
// ---------------------------------------------------------------------------

export function step(
  a: Asteroid,
  stars: readonly Star[],
  goal: Goal,
  dt: number,
): StepResult {
  a.bouncedThisStep = false;
  const result = newStepResult();
  if (!a.alive) return result;

  const x0 = a.x;
  const y0 = a.y;
  const [ax, ay] = acceleration(a.x, a.y, stars);
  const newX = a.x + a.vx * dt + 0.5 * ax * dt * dt;
  const newY = a.y + a.vy * dt + 0.5 * ay * dt * dt;

  // Swept collision against every star (capture radius for BH).
  for (const s of stars) {
    const colR = starCaptureRadius(s);
    if (segmentCircleHit(x0, y0, newX, newY, s.x, s.y, colR)) {
      a.alive = false;
      result.end = RoundEnd.CRASHED;
      result.crashedInto = s;
      return result;
    }
  }

  if (segmentCircleHit(x0, y0, newX, newY, goal.x, goal.y, goal.radius)) {
    a.alive = false;
    result.end = RoundEnd.SCORED;
    return result;
  }

  a.x = newX;
  a.y = newY;

  const [newAx, newAy] = acceleration(a.x, a.y, stars);
  a.vx += 0.5 * (ax + newAx) * dt;
  a.vy += 0.5 * (ay + newAy) * dt;
  a.ax = newAx;
  a.ay = newAy;

  if (bounceWalls(a)) {
    a.bouncedThisStep = true;
    result.bounced = true;
  }

  a.flightTime += dt;
  return result;
}

// ---------------------------------------------------------------------------
// Launch helpers
// ---------------------------------------------------------------------------

export function powerToSpeed(powerPct: number): number {
  const pct = Math.max(
    config.MIN_POWER_PCT,
    Math.min(config.MAX_POWER_PCT, powerPct),
  );
  const t = (pct - config.MIN_POWER_PCT) / (config.MAX_POWER_PCT - config.MIN_POWER_PCT);
  return (
    config.SPEED_AT_MIN_POWER +
    t * (config.SPEED_AT_MAX_POWER - config.SPEED_AT_MIN_POWER)
  );
}

export function makeShot(
  launcherX: number,
  launcherY: number,
  angleDeg: number,
  powerPct: number,
): Asteroid {
  const speed = powerToSpeed(powerPct);
  const angleRad = (angleDeg * Math.PI) / 180;
  // Canvas y-axis points DOWN; positive angle means "up and to the right",
  // so vy = -sin(angle).
  const vx = speed * Math.cos(angleRad);
  const vy = -speed * Math.sin(angleRad);
  return newAsteroid(launcherX, launcherY, vx, vy);
}
