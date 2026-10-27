import { describe, expect, it } from "vitest";

import { BackConfirm, BackGuard, backConfirmRule } from "../../src/touch/back";

describe("backConfirmRule", () => {
  it("play requires confirmation except at game_over", () => {
    expect(backConfirmRule({ scene: "play", phase: "aim" })).toBe(true);
    expect(backConfirmRule({ scene: "play", phase: "in_flight" })).toBe(true);
    expect(backConfirmRule({ scene: "play", phase: "post_shot" })).toBe(true);
    expect(backConfirmRule({ scene: "play", phase: "game_over" })).toBe(false);
  });

  it("battle requires confirmation except at match_end", () => {
    expect(backConfirmRule({ scene: "battle", phase: "aim" })).toBe(true);
    expect(backConfirmRule({ scene: "battle", phase: "post_shot" })).toBe(true);
    expect(backConfirmRule({ scene: "battle", phase: "round_end" })).toBe(true);
    expect(backConfirmRule({ scene: "battle", phase: "match_end" })).toBe(false);
  });

  it("initials requires confirmation until saved", () => {
    expect(backConfirmRule({ scene: "initials", saved: false })).toBe(true);
    expect(backConfirmRule({ scene: "initials", saved: true })).toBe(false);
  });

  it("other never requires confirmation", () => {
    expect(backConfirmRule({ scene: "other" })).toBe(false);
  });
});

describe("BackConfirm", () => {
  it("no confirmation needed returns act", () => {
    const c = new BackConfirm();
    expect(c.request(1000, false)).toBe("act");
  });

  it("prompts once per window, then acts inside it", () => {
    const c = new BackConfirm();
    expect(c.request(1000, true)).toBe("prompt");
    expect(c.request(3999, true)).toBe("act");
  });

  it("prompts again once the window expires", () => {
    const c = new BackConfirm();
    expect(c.request(1000, true)).toBe("prompt");
    expect(c.request(4000, true)).toBe("prompt");
  });

  it("pending is true inside the window and false at its edge", () => {
    const c = new BackConfirm();
    c.request(1000, true);
    expect(c.pending(1001)).toBe(true);
    expect(c.pending(4000)).toBe(false);
  });

  it("reset clears a pending prompt", () => {
    const c = new BackConfirm();
    c.request(1000, true);
    expect(c.pending(1500)).toBe(true);
    c.reset();
    expect(c.pending(1500)).toBe(false);
  });
});

describe("BackGuard", () => {
  it("disabled guard is inert", () => {
    const g = new BackGuard();
    expect(g.onSceneChange(false)).toEqual([]);
    expect(g.onActivation()).toEqual([]);
    expect(g.onPopState(1000, false)).toEqual({ back: false, ops: [] });
    expect(g.onEscapeKey(1000)).toEqual({ back: false, ops: [] });
  });

  it("enabling then entering a scene", () => {
    const g = new BackGuard();
    expect(g.setEnabled(true)).toEqual([]);
    expect(g.onSceneChange(false)).toEqual([{ op: "push", n: 2 }]);
    expect(g.onActivation()).toEqual([]);
  });

  it("single Back in a scene", () => {
    const g = new BackGuard();
    g.setEnabled(true);
    g.onSceneChange(false);
    expect(g.onPopState(5000, true)).toEqual({ back: true, ops: [{ op: "push", n: 1 }] });
  });

  it("Back, Back in a scene", () => {
    const g = new BackGuard();
    g.setEnabled(true);
    g.onSceneChange(false);
    expect(g.onPopState(1000, true)).toEqual({ back: true, ops: [{ op: "push", n: 1 }] });
    expect(g.onPopState(2000, true)).toEqual({ back: true, ops: [{ op: "push", n: 1 }] });
  });

  it("three Backs with no activation in between all count", () => {
    const g = new BackGuard();
    g.setEnabled(true);
    g.onSceneChange(false);
    expect(g.onPopState(1000, true).back).toBe(true);
    expect(g.onPopState(2000, true).back).toBe(true);
    expect(g.onPopState(3000, true).back).toBe(true);
  });

  it("returning to the menu unwinds", () => {
    const g = new BackGuard();
    g.setEnabled(true);
    g.onSceneChange(false);
    expect(g.onSceneChange(true)).toEqual([{ op: "go", delta: -2 }]);
    expect(g.onPopState(1000, true)).toEqual({ back: false, ops: [] });
    expect(g.onPopState(2000, false)).toEqual({ back: false, ops: [] });
  });

  it("Esc then popstate within 500 ms counts once", () => {
    const g = new BackGuard();
    g.setEnabled(true);
    g.onSceneChange(false);
    expect(g.onEscapeKey(1000).back).toBe(true);
    expect(g.onPopState(1400, true)).toEqual({ back: false, ops: [{ op: "push", n: 1 }] });
    expect(g.onPopState(1600, true).back).toBe(true);
  });

  it("Esc at the menu does not go back", () => {
    const g = new BackGuard();
    g.setEnabled(true);
    expect(g.onEscapeKey(1000).back).toBe(false);
  });

  it("stale entries after reload", () => {
    const g = new BackGuard();
    expect(g.onLoad(2)).toEqual([{ op: "go", delta: -2 }]);
    expect(g.onPopState(1000, false)).toEqual({ back: false, ops: [] });
    expect(g.onLoad(0)).toEqual([]);
  });

  it("popstate onto a guard entry at the menu", () => {
    const g = new BackGuard();
    g.setEnabled(true);
    expect(g.onPopState(1000, true)).toEqual({ back: false, ops: [{ op: "go", delta: -1 }] });
    expect(g.onPopState(2000, false)).toEqual({ back: false, ops: [] });
  });

  it("device becomes a PC while armed", () => {
    const g = new BackGuard();
    g.setEnabled(true);
    g.onSceneChange(false);
    expect(g.setEnabled(false)).toEqual([{ op: "go", delta: -2 }]);
    expect(g.setEnabled(false)).toEqual([]);
  });

  it("onActivation on the menu", () => {
    const g = new BackGuard();
    g.setEnabled(true);
    expect(g.onActivation()).toEqual([]);
  });
});
