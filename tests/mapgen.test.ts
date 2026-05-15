import { describe, expect, it } from "vitest";

import * as config from "../src/config";
import { type Star, starCaptureRadius } from "../src/entities";
import { GIANT_RADIUS_MAX_MULT } from "../src/config";
import { HANDMAPS, fallbackForLevel } from "../src/handmaps";
import {
  allowedTypesForLevel,
  generate,
  goalRadiusForLevel,
  shotSampler,
} from "../src/mapgen";

describe("allowed types by level", () => {
  it("low levels are restricted to easy types", () => {
    expect(new Set(allowedTypesForLevel(1))).toEqual(new Set(["standard", "brown_dwarf"]));
    expect(new Set(allowedTypesForLevel(2))).toEqual(new Set(["standard", "brown_dwarf"]));
  });
  it("unlocks red giant at level 3", () => {
    expect(allowedTypesForLevel(3)).toContain("red_giant");
  });
  it("unlocks blue giant at level 5 (not before)", () => {
    expect(allowedTypesForLevel(4)).not.toContain("blue_giant");
    expect(allowedTypesForLevel(5)).toContain("blue_giant");
  });
  it("unlocks black hole at level 7 (not before)", () => {
    expect(allowedTypesForLevel(6)).not.toContain("black_hole");
    expect(allowedTypesForLevel(7)).toContain("black_hole");
  });
});

describe("goal radius curve", () => {
  it("shrinks with level", () => {
    expect(goalRadiusForLevel(1)).toBe(config.GOAL_RADIUS_MAX);
    expect(goalRadiusForLevel(10)).toBe(config.GOAL_RADIUS_MIN);
    expect(goalRadiusForLevel(1)).toBeGreaterThan(goalRadiusForLevel(10));
  });
});

describe("generated map invariants", () => {
  it("respects launcher↔goal min separation", () => {
    const m = generate(2, 42);
    const sep = Math.hypot(m.launcher.x - m.goal.x, m.launcher.y - m.goal.y);
    expect(sep).toBeGreaterThanOrEqual(config.LAUNCHER_GOAL_MIN_SEP);
  });
  it("caps star count", () => {
    const m = generate(8, 7);
    expect(m.stars.length).toBeGreaterThanOrEqual(3);
    expect(m.stars.length).toBeLessThanOrEqual(config.MAX_STARS_PER_MAP);
  });
  it("no star overlaps launcher or goal", () => {
    const m = generate(4, 11);
    for (const s of m.stars) {
      const dL = Math.hypot(s.x - m.launcher.x, s.y - m.launcher.y);
      const dG = Math.hypot(s.x - m.goal.x, s.y - m.goal.y);
      const refR = starCaptureRadius(s);
      expect(dL).toBeGreaterThan(refR + 16);
      expect(dG).toBeGreaterThan(refR + m.goal.radius - 1);
    }
  });
  it("stars don't overlap each other", () => {
    const m = generate(7, 99);
    for (let i = 0; i < m.stars.length; i++) {
      for (let j = 0; j < m.stars.length; j++) {
        if (i === j) continue;
        const a: Star = m.stars[i];
        const b: Star = m.stars[j];
        const ra = starCaptureRadius(a);
        const rb = starCaptureRadius(b);
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        expect(d).toBeGreaterThanOrEqual(ra + rb);
      }
    }
  });
  it("blue/red giants get a per-instance radius multiplier in the configured range", () => {
    let sawScaledGiant = false;
    for (let seed = 0; seed < 30; seed++) {
      const m = generate(6, seed * 13 + 1);
      for (const s of m.stars) {
        if (s.starType === "blue_giant" || s.starType === "red_giant") {
          expect(typeof s.radiusMult).toBe("number");
          expect(s.radiusMult!).toBeGreaterThanOrEqual(1);
          expect(s.radiusMult!).toBeLessThanOrEqual(GIANT_RADIUS_MAX_MULT);
          if (s.radiusMult! > 1.05) sawScaledGiant = true;
        } else {
          // Other types should never be scaled.
          expect(s.radiusMult).toBeUndefined();
        }
      }
    }
    // Across 30 seeds at level 6, at least one giant should land above ~1.05.
    expect(sawScaledGiant).toBe(true);
  });
});

describe("shot-sampler certifies the simplest handmap", () => {
  it("L1 handmap passes the certification rule", () => {
    const m = HANDMAPS[0];
    const stats = shotSampler(m);
    expect(stats.scoringShots).toBeGreaterThanOrEqual(3);
    expect(stats.lowComplexityScoring).toBeGreaterThanOrEqual(1);
  });
});

describe("fallback table", () => {
  it("returns the appropriate handmap for the level band", () => {
    expect(fallbackForLevel(1).level).toBe(1);
    expect(fallbackForLevel(4).level).toBe(3);
    expect(fallbackForLevel(100).level).toBe(7);
  });
});
