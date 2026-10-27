import { describe, expect, it } from "vitest";

import {
  gameplayLayout,
  helpLayout,
  highscoresLayout,
  initialsLayout,
  menuLayout,
  settingsLayout,
  settingsRowY,
} from "../../src/touch/layouts";
import { REQUIRED_ACTIONS, covers } from "../../src/touch/keymap";
import { findControl, type Rect, type TouchLayout } from "../../src/touch/controls";
import { gap, overlaps } from "../../src/touch/geometry";
import {
  HUD_H,
  LOGICAL_H,
  LOGICAL_W,
  MONO_ADVANCE,
  PLAYFIELD_H,
  TOUCH_MIN_GAP,
  TOUCH_MIN_H,
  TOUCH_MIN_W,
} from "../../src/config";

const GAMEPLAY: Record<string, TouchLayout> = {
  "play.aim": gameplayLayout("play", "aim", { backPending: false }),
  "play.in_flight": gameplayLayout("play", "in_flight", { backPending: false }),
  "play.post_shot_scored": gameplayLayout("play", "post_shot", {
    backPending: false,
    scored: true,
    overlayLines: 4,
  }),
  "play.post_shot_other": gameplayLayout("play", "post_shot", {
    backPending: false,
    scored: false,
  }),
  "play.game_over": gameplayLayout("play", "game_over", { backPending: false }),
  "battle.aim": gameplayLayout("battle", "aim", { backPending: false }),
  "battle.in_flight": gameplayLayout("battle", "in_flight", { backPending: false }),
  "battle.post_shot": gameplayLayout("battle", "post_shot", { backPending: false }),
  "battle.round_end": gameplayLayout("battle", "round_end", { backPending: false }),
  "battle.match_end": gameplayLayout("battle", "match_end", { backPending: false }),
  "training.aim": gameplayLayout("training", "aim", { backPending: false }),
  "training.in_flight": gameplayLayout("training", "in_flight", { backPending: false }),
};

const STATES: Record<string, TouchLayout> = {
  "menu": menuLayout(6),
  "settings": settingsLayout(7, false),
  "highscores.endless": highscoresLayout(true, false),
  "highscores.battle": highscoresLayout(false, false),
  "help": helpLayout(false),
  "initials.editing": initialsLayout("editing", false),
  "initials.confirm": initialsLayout("confirm", false),
  "initials.done": initialsLayout("done", false),
  ...GAMEPLAY,
};

const GAMEPLAY_VARIANTS: TouchLayout[] = [
  gameplayLayout("play", "post_shot", { backPending: true, scored: true, overlayLines: 5 }),
  gameplayLayout("training", "aim", { backPending: true, previewOn: true, fieldOn: true }),
  gameplayLayout("battle", "aim", { backPending: true }),
];

const ALL: TouchLayout[] = [
  ...Object.values(STATES),
  settingsLayout(7, true),
  initialsLayout("editing", true),
  ...GAMEPLAY_VARIANTS,
];

const GAMEPLAY_LAYOUTS: TouchLayout[] = [...Object.values(GAMEPLAY), ...GAMEPLAY_VARIANTS];

const AIM_LAYOUTS: TouchLayout[] = [
  GAMEPLAY["play.aim"],
  GAMEPLAY["battle.aim"],
  GAMEPLAY["training.aim"],
  ...GAMEPLAY_VARIANTS.filter((layout) => layout.controls.some((c) => c.id === "pwr_up")),
];

const NO_BACK = new Set(["menu", "initials.done"]);

function label(layout: number, id: string): string {
  return `layout ${layout} control ${id}`;
}

function controlOf(layout: TouchLayout, id: string) {
  const found = layout.controls.find((control) => control.id === id);
  if (!found) throw new Error(`missing control: ${id}`);
  return found;
}

function readoutOf(layout: TouchLayout, id: string) {
  const found = layout.readouts.find((readout) => readout.id === id);
  if (!found) throw new Error(`missing readout: ${id}`);
  return found;
}

describe("layout states", () => {
  it("covers exactly the required state keys", () => {
    expect(Object.keys(STATES).sort()).toEqual(Object.keys(REQUIRED_ACTIONS).sort());
  });
});

describe("coverage", () => {
  for (const key of Object.keys(REQUIRED_ACTIONS)) {
    for (const action of REQUIRED_ACTIONS[key]) {
      const name = "focus" in action ? "focus" : action.key;
      it(`${key} covers ${name === " " ? "space" : name}`, () => {
        expect(covers(STATES[key], action), `${key} / ${name}`).toBe(true);
      });
    }
  }
});

describe("size", () => {
  it("keeps every control at least the minimum touch size and inside the canvas", () => {
    ALL.forEach((layout, index) => {
      for (const control of layout.controls) {
        expect(control.rect.w, label(index, control.id)).toBeGreaterThanOrEqual(TOUCH_MIN_W);
        expect(control.rect.h, label(index, control.id)).toBeGreaterThanOrEqual(TOUCH_MIN_H);
        expect(control.rect.x, label(index, control.id)).toBeGreaterThanOrEqual(0);
        expect(control.rect.y, label(index, control.id)).toBeGreaterThanOrEqual(0);
        expect(control.rect.x + control.rect.w, label(index, control.id)).toBeLessThanOrEqual(LOGICAL_W);
        expect(control.rect.y + control.rect.h, label(index, control.id)).toBeLessThanOrEqual(LOGICAL_H);
      }
    });
  });
});

describe("spacing", () => {
  it("keeps controls apart inside every layout", () => {
    for (const layout of ALL) {
      for (let i = 0; i < layout.controls.length; i++) {
        for (let j = i + 1; j < layout.controls.length; j++) {
          const a = layout.controls[i];
          const b = layout.controls[j];
          const message = `${a.id} vs ${b.id}`;
          expect(overlaps(a.rect, b.rect), message).toBe(false);
          expect(gap(a.rect, b.rect), message).toBeGreaterThanOrEqual(TOUCH_MIN_GAP);
        }
      }
    }
  });
});

const BAR_LINE = PLAYFIELD_H + HUD_H / 2;

function isOverlayButton(id: string): boolean {
  return id === "continue" || id === "menu";
}

function inside(inner: Rect, outer: Rect): boolean {
  return (
    inner.x >= outer.x &&
    inner.y >= outer.y &&
    inner.x + inner.w <= outer.x + outer.w &&
    inner.y + inner.h <= outer.y + outer.h
  );
}

describe("bottom bar", () => {
  it("keeps bar controls and readouts inside the bottom bar", () => {
    for (const layout of GAMEPLAY_LAYOUTS) {
      for (const control of layout.controls) {
        if (isOverlayButton(control.id)) continue;
        expect(control.rect.y, control.id).toBeGreaterThanOrEqual(PLAYFIELD_H);
        expect(control.rect.y + control.rect.h, control.id).toBeLessThanOrEqual(LOGICAL_H);
      }
      for (const readout of layout.readouts) {
        expect(readout.rect.x, readout.id).toBeGreaterThanOrEqual(0);
        expect(readout.rect.y, readout.id).toBeGreaterThanOrEqual(PLAYFIELD_H);
        expect(readout.rect.x + readout.rect.w, readout.id).toBeLessThanOrEqual(LOGICAL_W);
        expect(readout.rect.y + readout.rect.h, readout.id).toBeLessThanOrEqual(LOGICAL_H);
      }
      for (const control of layout.controls) {
        for (const readout of layout.readouts) {
          expect(overlaps(control.rect, readout.rect), `${control.id} vs ${readout.id}`).toBe(false);
        }
      }
    }
  });

  it("keeps overlay buttons on the playfield", () => {
    for (const layout of GAMEPLAY_LAYOUTS) {
      for (const control of layout.controls) {
        if (!isOverlayButton(control.id)) continue;
        expect(control.rect.y, control.id).toBeGreaterThanOrEqual(0);
        expect(control.rect.y + control.rect.h, control.id).toBeLessThanOrEqual(PLAYFIELD_H);
      }
    }
  });

  it("centers bar controls, panels and readouts on one line", () => {
    for (const layout of GAMEPLAY_LAYOUTS) {
      for (const control of layout.controls) {
        if (isOverlayButton(control.id)) continue;
        expect(control.rect.y + control.rect.h / 2, control.id).toBe(BAR_LINE);
      }
      for (const panel of layout.panels ?? []) {
        expect(panel.y + panel.h / 2).toBe(BAR_LINE);
      }
      for (const readout of layout.readouts) {
        const { y, h } = readout.rect;
        const centered = y + h / 2 === BAR_LINE;
        const halfRow = y + h === BAR_LINE || y === BAR_LINE;
        expect(centered || halfRow, readout.id).toBe(true);
      }
    }
  });

  it("puts the steppers inside panels and makes fire the primary button", () => {
    for (const layout of AIM_LAYOUTS) {
      const panels = layout.panels ?? [];
      expect(panels.length).toBe(2);
      for (const id of ["rot_ccw", "rot_cw", "pwr_down", "pwr_up"]) {
        const control = controlOf(layout, id);
        expect(control.style, id).toBe("segment");
        expect(panels.some((panel) => inside(control.rect, panel)), id).toBe(true);
      }
      expect(controlOf(layout, "fire").style).toBe("primary");
    }
  });
});

describe("readout room", () => {
  it("gives every readout room for its longest value", () => {
    for (const layout of GAMEPLAY_LAYOUTS) {
      for (const readout of layout.readouts) {
        expect(
          readout.maxChars * MONO_ADVANCE * readout.size,
          readout.id,
        ).toBeLessThanOrEqual(readout.rect.w);
      }
    }
  });

  it("fits the longest sample strings", () => {
    const play = GAMEPLAY["play.aim"];
    const battle = GAMEPLAY["battle.aim"];
    const training = GAMEPLAY["training.aim"];
    const trainingFlight = GAMEPLAY["training.in_flight"];

    expect("-179°".length).toBeLessThanOrEqual(readoutOf(play, "angle").maxChars);
    expect("100%".length).toBeLessThanOrEqual(readoutOf(play, "power").maxChars);
    expect("SCORE 999999".length).toBeLessThanOrEqual(readoutOf(play, "score").maxChars);
    expect("LV 99   LIVES 5   +12345".length).toBeLessThanOrEqual(readoutOf(play, "info").maxChars);
    expect("▶ ABCDEFGH".length).toBeLessThanOrEqual(readoutOf(battle, "p1_name").maxChars);
    expect("▶ ABCDEFGH".length).toBeLessThanOrEqual(readoutOf(battle, "p2_name").maxChars);
    expect("●●● 999999".length).toBeLessThanOrEqual(readoutOf(battle, "p1_info").maxChars);
    expect("●●● 999999".length).toBeLessThanOrEqual(readoutOf(battle, "p2_info").maxChars);
    expect("ROUND".length).toBeLessThanOrEqual(readoutOf(battle, "round_label").maxChars);
    expect("10/12".length).toBeLessThanOrEqual(readoutOf(battle, "round_value").maxChars);
    expect("L99".length).toBeLessThanOrEqual(readoutOf(training, "level").maxChars);
    expect("L99".length).toBeLessThanOrEqual(readoutOf(trainingFlight, "level").maxChars);
  });
});

describe("abort", () => {
  for (const mode of ["play", "battle", "training"] as const) {
    it(`${mode} abort clears fire`, () => {
      const abort = controlOf(gameplayLayout(mode, "in_flight", { backPending: false }), "abort");
      const fire = controlOf(gameplayLayout(mode, "aim", { backPending: false }), "fire");
      expect(overlaps(abort.rect, fire.rect)).toBe(false);
    });
  }
});

describe("steppers", () => {
  it("repeats the steppers and never fire", () => {
    for (const layout of AIM_LAYOUTS) {
      for (const id of ["rot_ccw", "rot_cw", "pwr_down", "pwr_up"]) {
        expect(controlOf(layout, id).repeat, id).toBe(true);
      }
      expect(controlOf(layout, "fire").repeat).toBe(false);
    }
  });
});

describe("back", () => {
  it("offers back everywhere except menu and done", () => {
    for (const [key, layout] of Object.entries(STATES)) {
      const ids = layout.controls.map((control) => control.id);
      expect(ids.includes("back"), key).toBe(!NO_BACK.has(key));
    }
  });
});

describe("hit tests", () => {
  const menu = STATES["menu"];
  const settings = STATES["settings"];
  const initialsEditing = STATES["initials.editing"];
  const initialsConfirm = STATES["initials.confirm"];
  const help = STATES["help"];
  const hsEndless = STATES["highscores.endless"];
  const playAim = GAMEPLAY["play.aim"];
  const trainingAim = GAMEPLAY["training.aim"];

  it("hits the expected controls", () => {
    expect(findControl(menu, 320, 238)?.id).toBe("item:3");
    expect(findControl(settings, 514, settingsRowY(2) + 8)?.id).toBe("settings:2:right");
    expect(findControl(settings, 200, settingsRowY(0) + 8)?.id).toBe("settings:0:row");
    expect(findControl(initialsEditing, 320, 112)?.id).toBe("slot:1:up");
    expect(findControl(initialsEditing, 320, 160)?.id).toBe("slot:1:letter");
    expect(findControl(initialsConfirm, 364, 304)?.id).toBe("edit");
    expect(findControl(help, 282, 330)?.id).toBe("help:left");
    expect(findControl(hsEndless, 400, 70)?.id).toBe("hs:right");
    expect(findControl(playAim, 593, 340)?.id).toBe("fire");
    expect(findControl(playAim, 27, 340)?.id).toBe("back");
    expect(findControl(playAim, 70, 340)?.id).toBe("rot_ccw");
    expect(findControl(playAim, 106, 340)?.id).toBeUndefined();
    expect(findControl(playAim, 188, 340)?.id).toBe("reset");
    expect(findControl(trainingAim, 354, 340)?.id).toBe("preview");
    expect(findControl(playAim, 320, 200)?.id).toBeUndefined();
  });
});
