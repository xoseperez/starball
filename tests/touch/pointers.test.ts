import { describe, expect, it } from "vitest";

import { PointerTracker } from "../../src/touch/pointers";
import type { Control, TouchCommand, TouchLayout } from "../../src/touch/controls";

const PLUS_COMMANDS: TouchCommand[] = [{ kind: "key", key: "ArrowUp" }];
const FIRE_COMMANDS: TouchCommand[] = [{ kind: "key", key: " " }];

const PLUS: Control = {
  id: "plus",
  rect: { x: 0, y: 0, w: 28, h: 24 },
  label: "plus",
  commands: PLUS_COMMANDS,
  repeat: true,
  style: "button",
};

const FIRE: Control = {
  id: "fire",
  rect: { x: 40, y: 0, w: 48, h: 24 },
  label: "fire",
  commands: FIRE_COMMANDS,
  repeat: false,
  style: "button",
};

const layout = (...controls: Control[]): TouchLayout => ({ controls, readouts: [] });
const BOTH = layout(PLUS, FIRE);
const WITHOUT_PLUS = layout(FIRE);

const PLUS_EMIT = { commands: PLUS_COMMANDS, coarse: false };
const FIRE_EMIT = { commands: FIRE_COMMANDS, coarse: false };

describe("PointerTracker", () => {
  it("emits nothing and tracks nothing for a tap on empty space", () => {
    const tracker = new PointerTracker();
    expect(tracker.down(1, 32, 12, 0, BOTH)).toEqual([]);
    expect(tracker.pressedIds().size).toBe(0);
    expect(tracker.up(1, 32, 12, BOTH)).toEqual([]);
    expect(tracker.tick(400, BOTH)).toEqual([]);
  });

  it("acts at once on a repeat press, repeats while held, and stops on release", () => {
    const tracker = new PointerTracker();
    expect(tracker.down(1, 4, 4, 0, BOTH)).toEqual([PLUS_EMIT]);
    expect(tracker.tick(399, BOTH)).toEqual([]);
    expect(tracker.tick(400, BOTH)).toEqual([PLUS_EMIT]);
    expect(tracker.up(1, 4, 4, BOTH)).toEqual([]);
    expect(tracker.tick(460, BOTH)).toEqual([]);
    expect(tracker.pressedIds().size).toBe(0);
  });

  it("emits a one-shot on release inside its rect", () => {
    const tracker = new PointerTracker();
    expect(tracker.down(1, 60, 4, 0, BOTH)).toEqual([]);
    expect(tracker.tick(400, BOTH)).toEqual([]);
    expect(tracker.up(1, 60, 4, BOTH)).toEqual([FIRE_EMIT]);
  });

  it("emits nothing when a one-shot is released outside its rect", () => {
    const tracker = new PointerTracker();
    expect(tracker.down(1, 60, 4, 0, BOTH)).toEqual([]);
    expect(tracker.up(1, 39, 4, BOTH)).toEqual([]);
  });

  it("keeps a one-shot dead after sliding off even if released back inside", () => {
    const tracker = new PointerTracker();
    expect(tracker.down(1, 60, 4, 0, BOTH)).toEqual([]);
    tracker.move(1, 32, 12, BOTH);
    expect(tracker.up(1, 60, 4, BOTH)).toEqual([]);
  });

  it("stops a held repeat once the pointer slides off the control", () => {
    const tracker = new PointerTracker();
    expect(tracker.down(1, 4, 4, 0, BOTH)).toEqual([PLUS_EMIT]);
    tracker.move(1, 32, 12, BOTH);
    expect(tracker.tick(1_000, BOTH)).toEqual([]);
    expect(tracker.tick(1_240, BOTH)).toEqual([]);
    expect(tracker.up(1, 32, 12, BOTH)).toEqual([]);
  });

  it("stops a held repeat when its control disappears from the layout", () => {
    const tracker = new PointerTracker();
    expect(tracker.down(1, 4, 4, 0, BOTH)).toEqual([PLUS_EMIT]);
    expect(tracker.tick(1_000, WITHOUT_PLUS)).toEqual([]);
    expect(tracker.pressedIds().size).toBe(0);
    expect(tracker.tick(1_060, BOTH)).toEqual([]);
  });

  it("keeps other pointers alive when one is released or cancelled", () => {
    const tracker = new PointerTracker();
    expect(tracker.down(1, 4, 4, 0, BOTH)).toEqual([PLUS_EMIT]);
    expect(tracker.down(2, 60, 4, 0, BOTH)).toEqual([]);
    expect(tracker.tick(400, BOTH)).toEqual([PLUS_EMIT]);
    expect(tracker.up(2, 60, 4, BOTH)).toEqual([FIRE_EMIT]);
    expect(tracker.pressedIds()).toEqual(new Set(["plus"]));
    expect(tracker.tick(460, BOTH)).toEqual([PLUS_EMIT]);
    tracker.cancel(1);
    expect(tracker.tick(520, BOTH)).toEqual([]);
    expect(tracker.pressedIds().size).toBe(0);

    expect(tracker.down(3, 4, 4, 0, BOTH)).toEqual([PLUS_EMIT]);
    expect(tracker.down(4, 60, 4, 0, BOTH)).toEqual([]);
    tracker.cancelAll();
    expect(tracker.pressedIds().size).toBe(0);
    expect(tracker.tick(600, BOTH)).toEqual([]);
    expect(tracker.up(3, 4, 4, BOTH)).toEqual([]);
    expect(tracker.up(4, 60, 4, BOTH)).toEqual([]);
  });

  it("reports pressed ids only for pointers still inside their control", () => {
    const tracker = new PointerTracker();
    expect(tracker.down(1, 4, 4, 0, BOTH)).toEqual([PLUS_EMIT]);
    expect(tracker.pressedIds()).toEqual(new Set(["plus"]));
    tracker.move(1, 32, 12, BOTH);
    expect(tracker.pressedIds().size).toBe(0);
  });

  it("produces coarse steps only from 1240 ms on for a long hold polled every 10 ms", () => {
    const tracker = new PointerTracker();
    expect(tracker.down(1, 4, 4, 0, BOTH)).toEqual([PLUS_EMIT]);
    const steps: Array<{ now: number; coarse: boolean }> = [];
    for (let now = 0; now <= 2_000; now += 10) {
      for (const emit of tracker.tick(now, BOTH)) {
        steps.push({ now, coarse: emit.coarse });
      }
    }
    expect(steps[0]).toEqual({ now: 400, coarse: false });
    expect(steps.some((step) => step.now === 1_240)).toBe(true);
    expect(steps.filter((step) => step.coarse).every((step) => step.now >= 1_240)).toBe(true);
    expect(steps.filter((step) => !step.coarse).every((step) => step.now < 1_240)).toBe(true);
    expect(steps.filter((step) => step.coarse).length).toBeGreaterThan(0);
  });
});
