import { describe, expect, it } from "vitest";

import * as config from "../src/config";
import { AimState } from "../src/input";

describe("AimState", () => {
  it("starts at defaults", () => {
    const a = new AimState();
    expect(a.angleDeg).toBe(30);
    expect(a.powerPct).toBe(50);
  });

  it("clamps power at the low end", () => {
    const a = new AimState(30, 10);
    a.adjustPower(-20);
    expect(a.powerPct).toBe(config.MIN_POWER_PCT);
  });

  it("clamps power at the high end", () => {
    const a = new AimState(30, 100);
    a.adjustPower(10);
    expect(a.powerPct).toBe(config.MAX_POWER_PCT);
  });

  it("supports small negative angle steps", () => {
    const a = new AimState(0, 50);
    a.adjustAngle(-1);
    expect(a.angleDeg).toBe(-1);
  });

  it("wraps just past 180°", () => {
    const a = new AimState(179, 50);
    a.adjustAngle(2);
    expect(a.angleDeg).toBe(-179);
  });

  it("reset() restores defaults", () => {
    const a = new AimState(123, 99);
    a.reset();
    expect(a.angleDeg).toBe(30);
    expect(a.powerPct).toBe(50);
  });
});
