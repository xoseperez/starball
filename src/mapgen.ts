// Procedural map generation with a shot-sampler solvability check.

import * as config from "./config";
import {
  type GameMap,
  type Launcher,
  type Goal,
  type Star,
  newLauncher,
  newGoal,
  starCaptureRadius,
} from "./entities";
import { fallbackForLevel } from "./handmaps";
import { makeShot, step, RoundEnd } from "./physics";
import { Random } from "./random";
import { ScoreAccumulator } from "./scoring";

const SAMPLER_DT = 1.0 / 60.0;
const LOW_COMPLEXITY_THRESHOLD = 1000;

export function allowedTypesForLevel(level: number): Star["starType"][] {
  const pool: Star["starType"][] = ["standard", "brown_dwarf"];
  if (level >= 3) pool.push("red_giant");
  if (level >= 5) pool.push("blue_giant");
  if (level >= 7) pool.push("black_hole");
  return pool;
}

export function numStarsForLevel(level: number, rng: Random): number {
  const base = Math.min(3 + Math.floor(level / 2), config.MAX_STARS_PER_MAP);
  return rng.randInt(Math.max(3, base - 1), base);
}

export function goalRadiusForLevel(level: number): number {
  if (level <= 1) return config.GOAL_RADIUS_MAX;
  if (level >= 10) return config.GOAL_RADIUS_MIN;
  const span = config.GOAL_RADIUS_MAX - config.GOAL_RADIUS_MIN;
  return config.GOAL_RADIUS_MAX - ((level - 1) / 9) * span;
}

// ---------------------------------------------------------------------------
// Shot sampler
// ---------------------------------------------------------------------------

export interface SamplerStats {
  scoringShots: number;
  lowComplexityScoring: number;
}

export function shotSampler(
  m: GameMap,
  nAngles = 9,
  powers: readonly number[] = [35, 55, 75, 90],
): SamplerStats {
  const dx = m.goal.x - m.launcher.x;
  const dy = m.goal.y - m.launcher.y;
  const centerRad = Math.atan2(-dy, dx);
  const coneDeg = 45.0;

  let scoring = 0;
  let lowCx = 0;

  for (let ai = 0; ai < nAngles; ai++) {
    const t = (ai / Math.max(1, nAngles - 1)) * 2 - 1; // -1 .. +1
    const angleDeg = (centerRad * 180) / Math.PI + t * coneDeg;
    for (const power of powers) {
      const result = simulateOne(m, angleDeg, power);
      if (result === "scored_low") {
        scoring++;
        lowCx++;
      } else if (result === "scored") {
        scoring++;
      }
    }
  }

  return { scoringShots: scoring, lowComplexityScoring: lowCx };
}

function simulateOne(m: GameMap, angleDeg: number, power: number): "scored_low" | "scored" | "failed" {
  const a = makeShot(m.launcher.x, m.launcher.y, angleDeg, power);
  const acc = new ScoreAccumulator();
  const maxTime = 6.0;
  while (a.alive && a.flightTime < maxTime) {
    const r = step(a, m.stars, m.goal, SAMPLER_DT);
    acc.update(a, m.stars, SAMPLER_DT, a.bouncedThisStep);
    if (r.end === RoundEnd.SCORED) {
      const cx = acc.runningCurvatureScore();
      return cx < LOW_COMPLEXITY_THRESHOLD ? "scored_low" : "scored";
    }
    if (r.end === RoundEnd.CRASHED) return "failed";
  }
  return "failed";
}

// ---------------------------------------------------------------------------
// Map generator
// ---------------------------------------------------------------------------

function dist(ax: number, ay: number, bx: number, by: number): number {
  return Math.hypot(ax - bx, ay - by);
}

function starTooClose(x: number, y: number, r: number, stars: readonly Star[]): boolean {
  for (const s of stars) {
    const refR = starCaptureRadius(s);
    if (dist(x, y, s.x, s.y) < (r + refR) * config.STAR_MIN_SEPARATION_MULT) return true;
  }
  return false;
}

function starOverlapsEndpoint(
  x: number, y: number, r: number, launcher: Launcher, goal: Goal,
): boolean {
  const keepout = 28;
  if (dist(x, y, launcher.x, launcher.y) < r + keepout) return true;
  if (dist(x, y, goal.x, goal.y) < r + goal.radius + 8) return true;
  return false;
}

function tryOne(
  rng: Random,
  level: number,
  nStars: number,
  allowed: Star["starType"][],
  goalRadius: number,
): GameMap | null {
  const pfTop = config.HUD_H + 16;
  const pfBot = config.LOGICAL_H - 16;

  const lx = rng.uniform(config.LAUNCHER_MARGIN_X + 8, config.LOGICAL_W / 3);
  const ly = rng.uniform(pfTop, pfBot);
  const gx = rng.uniform((config.LOGICAL_W * 2) / 3, config.LOGICAL_W - config.GOAL_MARGIN_X - 8);
  const gy = rng.uniform(pfTop, pfBot);

  if (dist(lx, ly, gx, gy) < config.LAUNCHER_GOAL_MIN_SEP) return null;

  const launcher = newLauncher(lx, ly);
  const goal = newGoal(gx, gy, goalRadius);

  const stars: Star[] = [];
  for (let i = 0; i < nStars; i++) {
    let placed = false;
    for (let attempt = 0; attempt < 40; attempt++) {
      const starType = rng.choice(allowed);
      // Roll the size multiplier BEFORE position so the RNG draw order is
      // independent of the rejection-retry loop body — keeps the seed → map
      // mapping deterministic on both client and server replay.
      const isGiant = starType === "blue_giant" || starType === "red_giant";
      const radiusMult = isGiant
        ? rng.uniform(config.GIANT_RADIUS_MIN_MULT, config.GIANT_RADIUS_MAX_MULT)
        : undefined;
      const candidate: Star = isGiant
        ? { x: 0, y: 0, starType, radiusMult }
        : { x: 0, y: 0, starType };
      const r = starCaptureRadius(candidate);
      const x = rng.uniform(64, config.LOGICAL_W - 64);
      const y = rng.uniform(pfTop + r, pfBot - r);
      candidate.x = x;
      candidate.y = y;
      if (starTooClose(x, y, r, stars)) continue;
      if (starOverlapsEndpoint(x, y, r, launcher, goal)) continue;
      stars.push(candidate);
      placed = true;
      break;
    }
    if (!placed) return null;
  }

  return { launcher, goal, stars, seed: 0, level };
}

export function generate(level: number, seed?: number): GameMap {
  const rng = new Random(seed);
  const radius = goalRadiusForLevel(level);
  const allowed = allowedTypesForLevel(level);
  const nStars = numStarsForLevel(level, rng);
  const requireLowComplexity = level <= 4;

  for (let attempt = 0; attempt < config.MAP_REJECTION_LIMIT; attempt++) {
    const m = tryOne(rng, level, nStars, allowed, radius);
    if (m === null) continue;
    const stats = shotSampler(m);
    if (stats.scoringShots >= 3) {
      if (!requireLowComplexity || stats.lowComplexityScoring >= 1) {
        return m;
      }
    }
  }

  // Fall back to a hand-authored map for this band.
  const fallback = fallbackForLevel(level);
  return {
    ...fallback,
    level,
    seed: seed ?? 0,
    // shallow-clone arrays/objects so callers don't mutate HANDMAPS
    launcher: { ...fallback.launcher },
    goal: { ...fallback.goal },
    stars: fallback.stars.map((s) => ({ ...s })),
  };
}
