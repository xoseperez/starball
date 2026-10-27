import { describe, expect, it } from "vitest";

import {
  BACK_RECT,
  ICONS,
  backControl,
  controlById,
  findControl,
  isIcon,
  type Control,
  type TouchLayout,
} from "../../src/touch/controls";
import { TOUCH, TouchMode } from "../../src/touch/mode";

const RECT = { x: 4, y: 8, w: 40, h: 24 };

function control(id: string, rect: { x: number; y: number; w: number; h: number }): Control {
  return { id, rect, label: id, commands: [], repeat: false, style: "button" };
}

function layout(...controls: Control[]): TouchLayout {
  return { controls, readouts: [] };
}

describe("TouchMode", () => {
  it("starts inactive", () => {
    expect(TOUCH.device).toBe(false);
    expect(TOUCH.active).toBe(false);
    expect(new TouchMode().active).toBe(false);
  });

  it("activates when the device is a touch device", () => {
    const mode = new TouchMode();
    mode.setDevice(true);
    expect(mode.device).toBe(true);
    expect(mode.active).toBe(true);
  });

  it("deactivates on key input", () => {
    const mode = new TouchMode();
    mode.setDevice(true);
    mode.onKey();
    expect(mode.active).toBe(false);
    expect(mode.device).toBe(true);
  });

  it("reactivates on pointer input only when the device is a touch device", () => {
    const mode = new TouchMode();
    mode.setDevice(true);
    mode.onKey();
    mode.onPointer();
    expect(mode.active).toBe(true);
  });

  it("keeps pointer input inert on non-touch devices", () => {
    const mode = new TouchMode();
    mode.onPointer();
    expect(mode.device).toBe(false);
    expect(mode.active).toBe(false);
  });

  it("clears both flags when the device is not a touch device", () => {
    const mode = new TouchMode();
    mode.setDevice(true);
    mode.setDevice(false);
    expect(mode.device).toBe(false);
    expect(mode.active).toBe(false);
    mode.onPointer();
    expect(mode.active).toBe(false);
  });
});

describe("isIcon", () => {
  it("accepts every icon label", () => {
    for (const icon of ICONS) {
      expect(isIcon(icon)).toBe(true);
    }
  });

  it("rejects non-icon labels", () => {
    expect(isIcon("FIRE")).toBe(false);
    expect(isIcon("")).toBe(false);
    expect(isIcon("rot_ccw ")).toBe(false);
  });
});

describe("backControl", () => {
  it("describes an idle back button", () => {
    const c = backControl(false);
    expect(c.id).toBe("back");
    expect(c.rect).toBe(BACK_RECT);
    expect(c.label).toBe("BACK");
    expect(c.commands).toEqual([{ kind: "back" }]);
    expect(c.repeat).toBe(false);
    expect(c.style).toBe("button");
    expect(c.lit).toBe(false);
  });

  it("describes a pending quit button", () => {
    const c = backControl(true);
    expect(c.id).toBe("back");
    expect(c.rect).toBe(BACK_RECT);
    expect(c.label).toBe("QUIT?");
    expect(c.commands).toEqual([{ kind: "back" }]);
    expect(c.repeat).toBe(false);
    expect(c.style).toBe("button");
    expect(c.lit).toBe(true);
  });

  it("accepts an override rect", () => {
    expect(backControl(false, { x: 6, y: 326, w: 42, h: 28 }).rect).toEqual({ x: 6, y: 326, w: 42, h: 28 });
    expect(backControl(false).rect).toBe(BACK_RECT);
  });
});

describe("findControl", () => {
  it("returns the control containing the point", () => {
    const hit = control("fire", RECT);
    expect(findControl(layout(hit), 4, 8)).toBe(hit);
    expect(findControl(layout(hit), 20, 20)).toBe(hit);
  });

  it("returns null for a point outside every control", () => {
    expect(findControl(layout(control("fire", RECT)), 43, 32)).toBeNull();
    expect(findControl(layout(), 20, 20)).toBeNull();
  });

  it("treats the right and bottom edges as exclusive", () => {
    const hit = control("fire", RECT);
    expect(findControl(layout(hit), 44, 20)).toBeNull();
    expect(findControl(layout(hit), 20, 32)).toBeNull();
  });

  it("returns the first of two overlapping controls", () => {
    const first = control("first", RECT);
    const second = control("second", RECT);
    expect(findControl(layout(first, second), 20, 20)).toBe(first);
    expect(findControl(layout(second, first), 20, 20)).toBe(second);
  });
});

describe("controlById", () => {
  it("finds a control by id", () => {
    const a = control("fire", RECT);
    const b = control("jump", { x: 50, y: 8, w: 40, h: 24 });
    expect(controlById(layout(a, b), "jump")).toBe(b);
  });

  it("returns null when no control matches", () => {
    expect(controlById(layout(control("fire", RECT)), "nope")).toBeNull();
    expect(controlById(layout(), "fire")).toBeNull();
  });
});
