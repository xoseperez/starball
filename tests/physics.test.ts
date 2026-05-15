import { describe, expect, it } from "vitest";

import * as config from "../src/config";
import {
  type Asteroid,
  type Goal,
  type Star,
  newAsteroid,
  newGoal,
} from "../src/entities";
import {
  RoundEnd,
  makeShot,
  powerToSpeed,
  segmentCircleHit,
  step,
  substepsForFrame,
} from "../src/physics";

function farGoal(): Goal {
  return newGoal(10000, 10000, 1);
}

function star(x: number, y: number, starType: Star["starType"]): Star {
  return { x, y, starType };
}

// Reference "energy" under Plummer-softened gravity for Newtonian stars.
function energy(a: Asteroid, stars: readonly Star[]): number {
  let ke = 0.5 * (a.vx * a.vx + a.vy * a.vy);
  let pe = 0;
  for (const s of stars) {
    const p = config.STAR_TYPES[s.starType];
    if (p.forceModel !== "newtonian") continue;
    const dx = s.x - a.x;
    const dy = s.y - a.y;
    const denom = Math.sqrt(dx * dx + dy * dy + p.softening * p.softening);
    pe -= (config.G_GRAV * p.mass) / denom;
  }
  return ke + pe;
}

describe("power_to_speed", () => {
  it("hits the endpoints", () => {
    expect(powerToSpeed(10)).toBeCloseTo(config.SPEED_AT_MIN_POWER);
    expect(powerToSpeed(100)).toBeCloseTo(config.SPEED_AT_MAX_POWER);
  });
  it("clamps out of range", () => {
    expect(powerToSpeed(0)).toBeCloseTo(config.SPEED_AT_MIN_POWER);
    expect(powerToSpeed(150)).toBeCloseTo(config.SPEED_AT_MAX_POWER);
  });
});

describe("segmentCircleHit", () => {
  it("returns true when starting inside the circle", () => {
    expect(segmentCircleHit(10, 10, 20, 20, 10, 10, 5)).toBe(true);
  });
  it("returns true when passing through", () => {
    expect(segmentCircleHit(0, 50, 100, 50, 50, 50, 10)).toBe(true);
  });
  it("returns false when passing far above", () => {
    expect(segmentCircleHit(0, 0, 100, 0, 50, 50, 10)).toBe(false);
  });
  it("returns false on a tangent miss", () => {
    expect(segmentCircleHit(0, 11, 100, 11, 50, 5, 5)).toBe(false);
  });
  it("catches tunneling at high speed in one step", () => {
    const a = newAsteroid(0, config.HUD_H + 100, 500, 0);
    const s = star(200, config.HUD_H + 100, "standard");
    const g = farGoal();
    const r = step(a, [s], g, 1.0);
    expect(r.end).toBe(RoundEnd.CRASHED);
  });
});

describe("free flight (no stars)", () => {
  it("moves in a straight line", () => {
    const a = newAsteroid(50, config.HUD_H + 100, 100, 0);
    const g = farGoal();
    for (let i = 0; i < 20; i++) step(a, [], g, 0.01);
    expect(a.y).toBeCloseTo(config.HUD_H + 100, 1);
    expect(a.x).toBeGreaterThan(50);
  });
});

describe("deflection", () => {
  it("deflects upward toward a star above the path", () => {
    const a = newAsteroid(50, config.HUD_H + 200, 120, 0);
    const s = star(300, config.HUD_H + 80, "standard");
    const g = farGoal();
    for (let i = 0; i < 120; i++) {
      if (!a.alive) break;
      step(a, [s], g, config.PHYSICS_DT);
    }
    expect(a.alive).toBe(true);
    expect(a.vy).toBeLessThan(0);
  });
});

describe("Verlet energy conservation", () => {
  it("drifts <1% over 200 steps of a clean fly-by", () => {
    const a = newAsteroid(170, config.HUD_H + 120, 180, 0);
    const s = star(320, config.HUD_H + 220, "brown_dwarf");
    const g = farGoal();
    const e0 = energy(a, [s]);
    for (let i = 0; i < 200; i++) {
      expect(a.alive).toBe(true);
      expect(a.bouncedThisStep).toBe(false);
      step(a, [s], g, config.PHYSICS_DT);
    }
    const e1 = energy(a, [s]);
    const drift = Math.abs(e1 - e0) / Math.abs(e0);
    expect(drift).toBeLessThan(0.01);
  });
});

describe("wall bounce", () => {
  it("inverts perpendicular velocity with damping", () => {
    const a = newAsteroid(config.LOGICAL_W - 1, config.HUD_H + 100, 200, 0);
    const g = farGoal();
    step(a, [], g, 0.05);
    expect(a.vx).toBeLessThan(0);
    expect(Math.abs(a.vx)).toBeCloseTo(200 * config.WALL_DAMPING, 0);
  });
  it("preserves tangential velocity", () => {
    const a = newAsteroid(config.LOGICAL_W - 1, config.HUD_H + 100, 200, 50);
    const g = farGoal();
    step(a, [], g, 0.05);
    expect(a.vy).toBeCloseTo(50, 0);
  });
});

describe("adaptive substep", () => {
  it("uses more substeps closer to a star", () => {
    const aFar = newAsteroid(0, config.HUD_H + 100, 0, 0);
    const aNear = newAsteroid(300, config.HUD_H + 160, 0, 0);
    const s = star(320, config.HUD_H + 160, "standard");
    expect(substepsForFrame(aNear, [s])).toBeGreaterThan(substepsForFrame(aFar, [s]));
  });
});

describe("black hole behavior", () => {
  it("captures the asteroid instantly inside the capture radius", () => {
    const a = newAsteroid(200, config.HUD_H + 100, 10, 0);
    const bh = star(210, config.HUD_H + 100, "black_hole");
    const g = farGoal();
    const r = step(a, [bh], g, 0.05);
    expect(r.end).toBe(RoundEnd.CRASHED);
    expect(a.alive).toBe(false);
  });
  it("pull magnitude stays bounded just outside the capture radius", () => {
    const bhParams = config.STAR_TYPES.black_hole;
    const RCap = bhParams.captureRadius!;
    const a = newAsteroid(100, config.HUD_H + 100, 200, 0);
    const bh = star(100 + RCap + 1.0, config.HUD_H + 100, "black_hole");
    const g = farGoal();
    const vBefore = Math.hypot(a.vx, a.vy);
    step(a, [bh], g, config.PHYSICS_DT);
    if (a.alive) {
      const vAfter = Math.hypot(a.vx, a.vy);
      expect(vAfter).toBeLessThan(2 * vBefore);
    }
  });
});

describe("make_shot", () => {
  it("0° aim points purely right", () => {
    const a = makeShot(50, 100, 0, 50);
    expect(a.vx).toBeGreaterThan(0);
    expect(a.vy).toBeCloseTo(0, 5);
  });
  it("90° aim points up", () => {
    const a = makeShot(50, 100, 90, 50);
    expect(a.vx).toBeCloseTo(0, 5);
    expect(a.vy).toBeLessThan(0);
  });
});
