import { describe, expect, it } from "vitest";

import * as config from "../src/config";
import {
  type Asteroid,
  type Goal,
  type Star,
  newAsteroid,
  newGoal,
} from "../src/entities";
import { makeShot, step } from "../src/physics";
import { ScoreAccumulator, wrapToPi } from "../src/scoring";

function farGoal(): Goal {
  return newGoal(10000, 10000, 1);
}

function star(x: number, y: number, t: Star["starType"]): Star {
  return { x, y, starType: t };
}

function simulate(a: Asteroid, stars: Star[], steps: number): ScoreAccumulator {
  const acc = new ScoreAccumulator();
  const g = farGoal();
  for (let i = 0; i < steps; i++) {
    if (!a.alive) break;
    step(a, stars, g, config.PHYSICS_DT);
    acc.update(a, stars, config.PHYSICS_DT, a.bouncedThisStep);
  }
  return acc;
}

describe("wrapToPi", () => {
  it("identity in range", () => {
    expect(wrapToPi(0)).toBe(0);
    expect(wrapToPi(Math.PI - 0.01)).toBeCloseTo(Math.PI - 0.01);
    expect(wrapToPi(Math.PI + 0.01)).toBeCloseTo(-Math.PI + 0.01, 6);
  });
  it("wraps through multiple revolutions", () => {
    expect(wrapToPi(5 * Math.PI)).toBeCloseTo(Math.PI, 9);
    expect(wrapToPi(-5 * Math.PI)).toBeCloseTo(-Math.PI, 9);
  });
});

describe("curvature", () => {
  it("is ~0 for a straight shot", () => {
    const a = newAsteroid(50, config.HUD_H + 100, 200, 0);
    const acc = simulate(a, [], 50);
    expect(acc.runningCurvature()).toBeLessThan(0.05);
  });

  it("accumulates noticeably on a slingshot", () => {
    const a = newAsteroid(50, config.HUD_H + 100, 180, 0);
    const s = star(240, config.HUD_H + 200, "standard");
    const acc = simulate(a, [s], 200);
    expect(acc.runningCurvature()).toBeGreaterThan(0.2);
  });

  it("per-star cap bounds orbit farming", () => {
    const a = makeShot(100, config.HUD_H + 160, 70, 30);
    const s = star(160, config.HUD_H + 160, "standard");
    const acc = simulate(a, [s], 2000);
    const rawCapPerStar = config.C_STAR_MAX / config.K_CURV;
    for (const v of acc.starCurv.values()) {
      expect(v).toBeLessThanOrEqual(rawCapPerStar + 1e-6);
    }
  });

  it("global cap holds even with many stars", () => {
    const stars: Star[] = [];
    for (let i = 0; i < 5; i++) stars.push(star(200 + i * 16, config.HUD_H + 160, "standard"));
    const a = newAsteroid(50, config.HUD_H + 161, 120, 0);
    const acc = simulate(a, stars, 3000);
    expect(acc.runningCurvatureScore()).toBeLessThanOrEqual(config.CURVATURE_GLOBAL_CAP + 1e-6);
  });

  it("excludes wall-collision frames", () => {
    const a = newAsteroid(config.LOGICAL_W - 2, config.HUD_H + 100, 300, 0);
    const g = farGoal();
    const acc = new ScoreAccumulator();
    // Prime prev_angle
    step(a, [], g, 0.005);
    acc.update(a, [], 0.005, a.bouncedThisStep);
    // This step bounces off the right wall
    step(a, [], g, 0.05);
    acc.update(a, [], 0.05, a.bouncedThisStep);
    expect(acc.runningCurvature()).toBe(0);
  });
});

describe("grazing bonus", () => {
  it("is zero when no star is grazed", () => {
    const a = newAsteroid(50, config.HUD_H + 30, 200, 0);
    const s = star(400, config.HUD_H + 300, "brown_dwarf");
    const acc = simulate(a, [s], 200);
    const br = acc.finalScore([s]);
    expect(br.grazing).toBe(0);
  });

  it("accrues on a near pass", () => {
    const a = newAsteroid(50, config.HUD_H + 100, 200, 0);
    const s = star(300, config.HUD_H + 110, "standard");
    const acc = simulate(a, [s], 150);
    const br = acc.finalScore([s]);
    expect(br.grazing).toBeGreaterThan(0);
  });
});

describe("assist events", () => {
  it("emits an assist when the asteroid enters a star's graze zone", () => {
    const a = newAsteroid(50, config.HUD_H + 100, 200, 0);
    const s = star(300, config.HUD_H + 110, "standard");
    const acc = simulate(a, [s], 200);
    expect(acc.assistEvents.length).toBeGreaterThanOrEqual(1);
    expect(acc.assistEvents[0].starIndex).toBe(0);
  });
});

describe("flight-time penalty", () => {
  it("no penalty inside the grace window", () => {
    const acc = new ScoreAccumulator();
    const br = acc.finalScore([], config.FLIGHT_TIME_GRACE_S - 1);
    expect(br.timeMultiplier).toBe(1);
    expect(br.total).toBe(config.SCORE_BASE);
  });

  it("decays linearly past the grace window", () => {
    const acc = new ScoreAccumulator();
    const mid = config.FLIGHT_TIME_GRACE_S + config.FLIGHT_TIME_PENALTY_WINDOW_S / 2;
    const br = acc.finalScore([], mid);
    expect(br.timeMultiplier).toBeCloseTo(0.5, 5);
    expect(br.total).toBe(Math.round(config.SCORE_BASE * 0.5));
  });

  it("floors at FLIGHT_TIME_PENALTY_FLOOR", () => {
    const acc = new ScoreAccumulator();
    const br = acc.finalScore([], 1000);
    expect(br.timeMultiplier).toBe(config.FLIGHT_TIME_PENALTY_FLOOR);
  });
});
