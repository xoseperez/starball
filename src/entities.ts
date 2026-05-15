// Game-world entities. Plain mutable objects in logical pixel units.
// (0, 0) is top-left of the logical canvas; the playfield begins at y = HUD_H
// and extends to y = LOGICAL_H.

import { STAR_TYPES, type StarParams, type StarType } from "./config";

export interface Star {
  x: number;
  y: number;
  starType: StarType;
  // Optional per-instance radius multiplier. Set by mapgen for blue/red giants
  // (range GIANT_RADIUS_MIN_MULT..GIANT_RADIUS_MAX_MULT). Absent ⇒ 1.0.
  // Mass is not scaled — only the visible body, collision radius, softening,
  // and (for blue giants) the repulsion zone scale with this multiplier.
  radiusMult?: number;
}

export function starParams(s: Star): StarParams {
  return STAR_TYPES[s.starType];
}

export function starRadius(s: Star): number {
  return STAR_TYPES[s.starType].radius * (s.radiusMult ?? 1);
}

export function starMass(s: Star): number {
  return STAR_TYPES[s.starType].mass;
}

export function starSoftening(s: Star): number {
  return STAR_TYPES[s.starType].softening * (s.radiusMult ?? 1);
}

// Effective collision/interaction radius. Black holes report their fixed
// captureRadius (radiusMult ignored); other types report the scaled body.
export function starCaptureRadius(s: Star): number {
  const p = STAR_TYPES[s.starType];
  return p.captureRadius ?? starRadius(s);
}

export interface Asteroid {
  x: number;
  y: number;
  vx: number;
  vy: number;
  alive: boolean;
  flightTime: number;
  ax: number;
  ay: number;
  bouncedThisStep: boolean;
}

export function newAsteroid(x: number, y: number, vx = 0, vy = 0): Asteroid {
  return {
    x,
    y,
    vx,
    vy,
    alive: true,
    flightTime: 0,
    ax: 0,
    ay: 0,
    bouncedThisStep: false,
  };
}

export interface Launcher {
  x: number;
  y: number;
  angleDeg: number;
  powerPct: number;
}

export function newLauncher(x: number, y: number, angleDeg = 30, powerPct = 50): Launcher {
  return { x, y, angleDeg, powerPct };
}

export interface Goal {
  x: number;
  y: number;
  radius: number;
}

export function newGoal(x: number, y: number, radius = 14): Goal {
  return { x, y, radius };
}

export interface GameMap {
  launcher: Launcher;
  goal: Goal;
  stars: Star[];
  seed: number;
  level: number;
}
