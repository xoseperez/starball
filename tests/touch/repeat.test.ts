import { describe, expect, it } from "vitest";

import {
  TOUCH_COARSE_AFTER_MS,
  TOUCH_MAX_STEPS_PER_TICK,
  TOUCH_REPEAT_DELAY_MS,
  TOUCH_REPEAT_INTERVAL_MS,
} from "../../src/config";
import { HoldRepeat } from "../../src/touch/repeat";

type Collected = {
  totals: Map<number, number>;
  steps: Array<{ now: number; slot: number; coarse: boolean }>;
};

const collect = (pressedAt: number, until: number, extraTimes: number[] = []): Collected => {
  const times = new Set<number>();
  for (let now = pressedAt; now <= until; now += 10) times.add(now);
  for (const now of extraTimes) times.add(now);
  const repeat = new HoldRepeat(pressedAt);
  const totals = new Map<number, number>();
  const steps: Array<{ now: number; slot: number; coarse: boolean }> = [];
  for (const now of [...times].sort((a, b) => a - b)) {
    for (const step of repeat.due(now)) {
      const index = steps.length;
      steps.push({
        now,
        slot: pressedAt + TOUCH_REPEAT_DELAY_MS + index * TOUCH_REPEAT_INTERVAL_MS,
        coarse: step.coarse,
      });
    }
    totals.set(now, steps.length);
  }
  return { totals, steps };
};

describe("HoldRepeat", () => {
  it("matches the reference totals when polled every 10 ms", () => {
    const { totals, steps } = collect(0, 1250, [1199]);
    expect(totals.get(0)).toBe(0);
    expect(totals.get(390)).toBe(0);
    expect(totals.get(400)).toBe(1);
    expect(totals.get(460)).toBe(2);
    expect(totals.get(1199)).toBe(14);
    expect(totals.get(1200)).toBe(14);
    expect(totals.get(1240)).toBe(15);
    expect(steps[14]).toBeDefined();
    expect(steps[14].slot).toBe(1240);
    expect(steps[14].coarse).toBe(true);
  });

  it("marks steps fine before the coarse threshold and coarse from it onward", () => {
    const { steps } = collect(0, 2000);
    const fine = steps.filter((step) => step.slot < TOUCH_COARSE_AFTER_MS);
    const coarse = steps.filter((step) => step.slot >= TOUCH_COARSE_AFTER_MS);
    expect(fine.length).toBe(14);
    expect(fine.every((step) => !step.coarse)).toBe(true);
    expect(coarse.length).toBeGreaterThan(0);
    expect(coarse.every((step) => step.coarse)).toBe(true);
    expect(coarse.every((step) => step.slot >= 1240)).toBe(true);
    expect(steps.every((step) => step.coarse === (step.slot >= TOUCH_COARSE_AFTER_MS))).toBe(true);
  });

  it("drops overdue slots beyond the per-tick cap", () => {
    const repeat = new HoldRepeat(0);
    expect(repeat.due(0)).toHaveLength(0);
    const burst = repeat.due(1199);
    expect(burst).toHaveLength(TOUCH_MAX_STEPS_PER_TICK);
    expect(burst.every((step) => !step.coarse)).toBe(true);
    expect(repeat.due(1199)).toHaveLength(0);
    expect(repeat.due(1240)).toEqual([{ coarse: true }]);
  });

  it("consumes each slot only once for repeated calls at the same now", () => {
    const repeat = new HoldRepeat(0);
    expect(repeat.due(0)).toHaveLength(0);
    expect(repeat.due(0)).toHaveLength(0);
    expect(repeat.due(400)).toHaveLength(1);
    expect(repeat.due(400)).toHaveLength(0);
    expect(repeat.due(460)).toHaveLength(1);
    expect(repeat.due(460)).toHaveLength(0);
    expect(repeat.due(580)).toHaveLength(2);
    expect(repeat.due(580)).toHaveLength(0);
  });

  it("behaves identically for a later pressedAt", () => {
    const base = collect(0, 2000);
    const shifted = collect(5000, 7000);
    expect(shifted.steps.length).toBe(base.steps.length);
    expect(shifted.steps.map((step) => step.coarse)).toEqual(base.steps.map((step) => step.coarse));
    expect(shifted.steps.map((step) => step.now - 5000)).toEqual(base.steps.map((step) => step.now));
    for (const [now, total] of base.totals) {
      expect(shifted.totals.get(now + 5000)).toBe(total);
    }
  });
});
