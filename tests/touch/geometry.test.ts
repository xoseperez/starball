import { describe, expect, it } from "vitest";

import { LOGICAL_H, LOGICAL_W } from "../../src/config";
import {
  contains,
  gap,
  overlaps,
  renderTransform,
  screenToLogical,
} from "../../src/touch/geometry";
import { isPortrait, isTouchDevice } from "../../src/touch/device";

const RECT = { x: 10, y: 20, w: 30, h: 40 };

const VIEWPORTS: Array<[number, number, number]> = [
  [1024, 768, 2],
  [1280, 800, 1.5],
  [1366, 1024, 2],
  [1920, 1080, 1],
  [844, 390, 3],
  [800, 1280, 2],
];

const LOGICAL_XS: number[] = [0, 1, 37, 319, 320, 320.5, 321, 639, LOGICAL_W - 1, LOGICAL_W];
const LOGICAL_YS: number[] = [0, 1, 71, 179, 180, 180.5, 181, 359, LOGICAL_H - 1, LOGICAL_H];

describe("contains", () => {
  it("accepts the left and top edges and the interior", () => {
    expect(contains(RECT, 10, 20)).toBe(true);
    expect(contains(RECT, 39.999, 59.999)).toBe(true);
  });

  it("rejects the right and bottom edges", () => {
    expect(contains(RECT, 40, 25)).toBe(false);
    expect(contains(RECT, 25, 60)).toBe(false);
  });

  it("rejects points past the left and top edges", () => {
    expect(contains(RECT, 9.999, 25)).toBe(false);
    expect(contains(RECT, 25, 19.999)).toBe(false);
  });
});

describe("overlaps", () => {
  it("is false when rects touch on an edge", () => {
    expect(overlaps({ x: 0, y: 0, w: 10, h: 10 }, { x: 10, y: 0, w: 10, h: 10 })).toBe(false);
    expect(overlaps({ x: 0, y: 0, w: 10, h: 10 }, { x: 0, y: 10, w: 10, h: 10 })).toBe(false);
  });

  it("is false when rects touch on a corner", () => {
    expect(overlaps({ x: 0, y: 0, w: 10, h: 10 }, { x: 10, y: 10, w: 10, h: 10 })).toBe(false);
  });

  it("is true when rects share area", () => {
    expect(overlaps({ x: 0, y: 0, w: 10, h: 10 }, { x: 9.5, y: 0, w: 10, h: 10 })).toBe(true);
    expect(overlaps({ x: 0, y: 0, w: 10, h: 10 }, { x: 2, y: 2, w: 4, h: 4 })).toBe(true);
  });
});

describe("gap", () => {
  it("measures the axis gap with the larger separation", () => {
    expect(gap({ x: 0, y: 0, w: 10, h: 10 }, { x: 20, y: 0, w: 10, h: 10 })).toBe(10);
    expect(gap({ x: 0, y: 0, w: 10, h: 10 }, { x: 0, y: 30, w: 10, h: 10 })).toBe(20);
    expect(gap({ x: 0, y: 0, w: 10, h: 10 }, { x: 20, y: 20, w: 10, h: 10 })).toBe(10);
    expect(gap({ x: 0, y: 0, w: 10, h: 10 }, { x: 20, y: 5, w: 10, h: 10 })).toBe(10);
  });

  it("is zero when touching or overlapping", () => {
    expect(gap({ x: 0, y: 0, w: 10, h: 10 }, { x: 10, y: 0, w: 10, h: 10 })).toBe(0);
    expect(gap({ x: 0, y: 0, w: 10, h: 10 }, { x: 5, y: 5, w: 10, h: 10 })).toBe(0);
    expect(gap({ x: 0, y: 0, w: 10, h: 10 }, { x: 2, y: 0, w: 4, h: 4 })).toBe(0);
  });
});

describe("renderTransform", () => {
  it("sizes the backing store from the viewport and dpr", () => {
    const t = renderTransform(1024, 768, 2);
    expect(t.canvasW).toBe(2048);
    expect(t.canvasH).toBe(1536);
    expect(t.scaleX).toBeCloseTo(2048 / LOGICAL_W, 10);
    expect(t.scaleY).toBeCloseTo(1536 / LOGICAL_H, 10);
  });

  it("rounds the backing store for a fractional dpr", () => {
    const t = renderTransform(1280, 800, 1.5);
    expect(t.canvasW).toBe(1920);
    expect(t.canvasH).toBe(1200);
  });

  it("handles a high density phone viewport", () => {
    const t = renderTransform(844, 390, 3);
    expect(t.canvasW).toBe(2532);
    expect(t.canvasH).toBe(1170);
  });

  it("rounds a fractional viewport", () => {
    const t = renderTransform(100.4, 50.6, 1);
    expect(t.canvasW).toBe(100);
    expect(t.canvasH).toBe(51);
  });
});

describe("screenToLogical round trip", () => {
  for (const [viewW, viewH, dpr] of VIEWPORTS) {
    it(`returns the original logical point at ${viewW}x${viewH} dpr ${dpr}`, () => {
      const t = renderTransform(viewW, viewH, dpr);
      for (const x of LOGICAL_XS) {
        for (const y of LOGICAL_YS) {
          const backingX = x * t.scaleX;
          const backingY = y * t.scaleY;
          const cssX = (backingX / t.canvasW) * viewW;
          const cssY = (backingY / t.canvasH) * viewH;
          const back = screenToLogical(cssX, cssY, viewW, viewH);
          expect(Math.abs(back.x - x)).toBeLessThan(0.5);
          expect(Math.abs(back.y - y)).toBeLessThan(0.5);
        }
      }
    });
  }
});

describe("isTouchDevice", () => {
  it("requires a coarse pointer and no hover", () => {
    expect(isTouchDevice({ pointerCoarse: true, hoverNone: true })).toBe(true);
  });

  it("is false when either signal is missing", () => {
    expect(isTouchDevice({ pointerCoarse: true, hoverNone: false })).toBe(false);
    expect(isTouchDevice({ pointerCoarse: false, hoverNone: true })).toBe(false);
    expect(isTouchDevice({ pointerCoarse: false, hoverNone: false })).toBe(false);
  });
});

describe("isPortrait", () => {
  it("is true only when height exceeds width", () => {
    expect(isPortrait(800, 800)).toBe(false);
    expect(isPortrait(800, 801)).toBe(true);
    expect(isPortrait(801, 800)).toBe(false);
  });
});
