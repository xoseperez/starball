import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../src/api", () => ({
  fetchRemoteScores: async () => null,
  submitRemoteScore: async () => null,
}));

import { BattleScene } from "../../src/scenes/battle";
import { type Scene } from "../../src/scenes/base";
import { HelpScene } from "../../src/scenes/help";
import { HighscoresScene } from "../../src/scenes/highscores";
import { InitialsScene } from "../../src/scenes/initials";
import { MenuScene } from "../../src/scenes/menu";
import { PlayScene } from "../../src/scenes/play";
import { SandboxScene } from "../../src/scenes/sandbox";
import { SettingsScene } from "../../src/scenes/settings";
import { type AimState } from "../../src/input";
import { resetStoreForTests } from "../../src/persistence";
import { SETTINGS } from "../../src/settings_store";
import { backConfirmRule } from "../../src/touch/back";
import { controlById, type TouchContext } from "../../src/touch/controls";
import { dispatch } from "../../src/touch/dispatch";
import { TOUCH } from "../../src/touch/mode";

const CTX: TouchContext = { backPending: false, device: true };

function peek<T>(o: object, k: string): T {
  return (o as unknown as Record<string, T>)[k];
}

function tap(scene: Scene, id: string, coarse = false): void {
  const c = controlById(scene.touchLayout(CTX), id);
  expect(c, id).not.toBeNull();
  dispatch(
    scene,
    { commands: c!.commands, coarse },
    {
      back: () => scene.handleEvent({ key: "Escape", shift: false }),
    },
  );
}

function press(scene: Scene, key: string, shift = false): void {
  scene.handleEvent({ key, shift });
}

function resetIsolation(): void {
  resetStoreForTests();
  SETTINGS.load();
}

async function opened(scene: Scene): Promise<string | undefined> {
  await vi.waitFor(() => expect(scene.nextScene).not.toBeNull());
  return scene.nextScene?.constructor.name;
}

function advanceToConfirm(scene: InitialsScene, via: "tap" | "press"): void {
  for (let n = 0; n < 4 && !peek<boolean>(scene, "awaitingConfirm"); n++) {
    if (via === "tap") tap(scene, "ok");
    else press(scene, "Enter");
  }
}

beforeEach(() => {
  resetStoreForTests();
  SETTINGS.load();
  TOUCH.setDevice(false);
});

afterEach(() => {
  vi.restoreAllMocks();
  TOUCH.setDevice(false);
});

describe("scene isolation", () => {
  it("has no AudioContext, so BANK.play can never synthesize", () => {
    expect((globalThis as { AudioContext?: unknown }).AudioContext).toBeUndefined();
  });
});

describe("menu", () => {
  it("item:2 matches two ArrowDown presses plus Enter", async () => {
    const m = new MenuScene();
    const k = new MenuScene();

    tap(m, "item:2");
    press(k, "ArrowDown");
    press(k, "ArrowDown");
    press(k, "Enter");

    expect(peek<number>(m, "cursor")).toBe(2);
    expect(peek<number>(k, "cursor")).toBe(2);
    expect(await opened(m)).toBe("SandboxScene");
    expect(await opened(k)).toBe("SandboxScene");
  });

  it("item:3 opens high scores", async () => {
    const m = new MenuScene();
    tap(m, "item:3");
    expect(await opened(m)).toBe("HighscoresScene");
  });
});

describe("settings", () => {
  it("settings:3:right matches ArrowDown x3 then ArrowRight", async () => {
    const s1 = new SettingsScene();
    tap(s1, "settings:3:right");
    const touchCursor = peek<number>(s1, "cursor");
    const touchLives = SETTINGS.get("lives");

    resetIsolation();
    const s2 = new SettingsScene();
    press(s2, "ArrowDown");
    press(s2, "ArrowDown");
    press(s2, "ArrowDown");
    press(s2, "ArrowRight");

    expect(touchCursor).toBe(3);
    expect(peek<number>(s2, "cursor")).toBe(touchCursor);
    expect(SETTINGS.get("lives")).toBe(touchLives);

    tap(s1, "back");
    expect(await opened(s1)).toBe("MenuScene");
  });
});

describe("high scores", () => {
  it("hs:right cycles difficulty like ArrowRight", () => {
    const t = new HighscoresScene("endless");
    const k = new HighscoresScene("endless");

    tap(t, "hs:right");
    press(k, "ArrowRight");

    expect(peek<string>(t, "difficulty")).toBe(peek<string>(k, "difficulty"));
  });
});

describe("help", () => {
  it("help:right pages match the keyboard on a touch device", () => {
    TOUCH.setDevice(true);
    const t = new HelpScene();
    const k = new HelpScene();

    tap(t, "help:right");
    tap(t, "help:right");
    press(k, "ArrowRight");
    press(k, "ArrowRight");

    expect(peek<number>(t, "page")).toBe(2);
    expect(peek<number>(k, "page")).toBe(2);
  });

  it("two ArrowRight presses wrap back to page 0 without a touch device", () => {
    TOUCH.setDevice(false);
    const t = new HelpScene();
    const k = new HelpScene();

    tap(t, "help:right");
    tap(t, "help:right");
    press(k, "ArrowRight");
    press(k, "ArrowRight");

    expect(peek<number>(t, "page")).toBe(0);
    expect(peek<number>(k, "page")).toBe(0);
  });
});

describe("initials", () => {
  it("touch controls walk the same submit flow as the keyboard", () => {
    const t = new InitialsScene({ mode: "endless", score: 1000 });
    const k = new InitialsScene({ mode: "endless", score: 1000 });

    tap(t, "slot:1:letter");
    press(k, "ArrowRight");
    expect(peek<number>(t, "cursor")).toBe(1);
    expect(peek<number>(k, "cursor")).toBe(1);

    tap(t, "slot:1:up");
    press(k, "ArrowUp");
    expect(peek<number[]>(t, "letters")).toEqual(peek<number[]>(k, "letters"));

    advanceToConfirm(t, "tap");
    advanceToConfirm(k, "press");
    expect(peek<boolean>(t, "awaitingConfirm")).toBe(true);
    expect(peek<boolean>(k, "awaitingConfirm")).toBe(peek<boolean>(t, "awaitingConfirm"));

    tap(t, "edit");
    press(k, "Backspace");
    expect(peek<boolean>(t, "awaitingConfirm")).toBe(false);
    expect(peek<boolean>(k, "awaitingConfirm")).toBe(false);

    expect(t.backNeedsConfirm()).toBe(true);
    expect(k.backNeedsConfirm()).toBe(true);

    advanceToConfirm(t, "tap");
    advanceToConfirm(k, "press");
    resetIsolation();
    tap(t, "ok");
    expect(peek<boolean>(t, "doneEntry")).toBe(true);
    expect(t.backNeedsConfirm()).toBe(false);
    expect(t.touchLayout(CTX).controls).toHaveLength(0);

    resetIsolation();
    press(k, "Enter");
    expect(peek<boolean>(k, "doneEntry")).toBe(peek<boolean>(t, "doneEntry"));
    expect(k.backNeedsConfirm()).toBe(false);
    expect(k.touchLayout(CTX).controls).toHaveLength(0);
  });
});

describe("play", () => {
  it("every gameplay control matches its key", () => {
    const t = new PlayScene(12345);
    const k = new PlayScene(12345);

    tap(t, "rot_ccw");
    press(k, "ArrowLeft");
    expect(peek<AimState>(t, "aim").angleDeg).toBe(peek<AimState>(k, "aim").angleDeg);

    const coarseStep = SETTINGS.get("power_step_pct") * SETTINGS.get("shift_multiplier");
    tap(t, "pwr_up", true);
    press(k, "ArrowUp", true);
    expect(peek<AimState>(t, "aim").powerPct).toBe(55 + coarseStep);
    expect(peek<AimState>(k, "aim").powerPct).toBe(peek<AimState>(t, "aim").powerPct);

    const beforeFine = peek<AimState>(t, "aim").powerPct;
    tap(t, "pwr_down");
    press(k, "ArrowDown");
    expect(beforeFine - peek<AimState>(t, "aim").powerPct).toBe(SETTINGS.get("power_step_pct"));
    expect(peek<AimState>(k, "aim").powerPct).toBe(peek<AimState>(t, "aim").powerPct);

    tap(t, "reset");
    press(k, "r");
    expect(peek<AimState>(t, "aim").angleDeg).toBe(peek<AimState>(k, "aim").angleDeg);
    expect(peek<AimState>(t, "aim").powerPct).toBe(peek<AimState>(k, "aim").powerPct);

    tap(t, "fire");
    press(k, " ");
    expect(peek<string>(t, "phase")).toBe("in_flight");
    expect(peek<string>(k, "phase")).toBe("in_flight");

    tap(t, "abort");
    press(k, "a");
    expect(peek<string>(k, "phase")).toBe(peek<string>(t, "phase"));
  });
});

describe("battle", () => {
  it("every gameplay control matches its key", () => {
    const t = new BattleScene(12345);
    const k = new BattleScene(12345);

    tap(t, "rot_cw");
    press(k, "ArrowRight");
    expect(peek<AimState>(t, "aim").angleDeg).toBe(peek<AimState>(k, "aim").angleDeg);

    const coarseStep = SETTINGS.get("power_step_pct") * SETTINGS.get("shift_multiplier");
    const beforePower = peek<AimState>(t, "aim").powerPct;
    tap(t, "pwr_down", true);
    press(k, "ArrowDown", true);
    expect(beforePower - peek<AimState>(t, "aim").powerPct).toBe(coarseStep);
    expect(peek<AimState>(k, "aim").powerPct).toBe(peek<AimState>(t, "aim").powerPct);

    tap(t, "fire");
    press(k, " ");
    expect(peek<string>(t, "phase")).toBe("in_flight");
    expect(peek<string>(k, "phase")).toBe("in_flight");
  });
});

describe("training", () => {
  it("every gameplay control matches its key on the same map", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.42);
    const t = new SandboxScene();
    const k = new SandboxScene();

    const beforeAngleT = peek<AimState>(t, "aim").angleDeg;
    const beforeAngleK = peek<AimState>(k, "aim").angleDeg;
    tap(t, "rot_ccw", true);
    press(k, "ArrowLeft", true);
    expect(peek<AimState>(t, "aim").angleDeg - beforeAngleT).toBe(5);
    expect(peek<AimState>(k, "aim").angleDeg - beforeAngleK).toBe(5);

    const beforePowerT = peek<AimState>(t, "aim").powerPct;
    const beforePowerK = peek<AimState>(k, "aim").powerPct;
    tap(t, "pwr_up");
    press(k, "ArrowUp");
    expect(peek<AimState>(t, "aim").powerPct - beforePowerT).toBe(1);
    expect(peek<AimState>(k, "aim").powerPct - beforePowerK).toBe(1);

    tap(t, "preview");
    press(k, "t");
    expect(peek<boolean>(t, "previewOn")).toBe(false);
    expect(peek<boolean>(k, "previewOn")).toBe(peek<boolean>(t, "previewOn"));

    tap(t, "field");
    press(k, "g");
    expect(peek<boolean>(t, "fieldOn")).toBe(true);
    expect(peek<boolean>(k, "fieldOn")).toBe(peek<boolean>(t, "fieldOn"));

    tap(t, "new_map");
    press(k, "n");
    expect(peek<{ level: number }>(t, "map").level).toBe(peek<{ level: number }>(k, "map").level);
  });
});

describe("back confirmation rules", () => {
  it("play mirrors backConfirmRule for every phase", () => {
    const p = new PlayScene(12345);
    for (const phase of ["aim", "in_flight", "post_shot", "game_over"]) {
      (p as unknown as { phase: string }).phase = phase;
      expect(p.backNeedsConfirm()).toBe(backConfirmRule({ scene: "play", phase }));
    }
  });

  it("battle mirrors backConfirmRule for every phase", () => {
    const b = new BattleScene(12345);
    for (const phase of ["aim", "in_flight", "post_shot", "round_end", "match_end"]) {
      (b as unknown as { phase: string }).phase = phase;
      expect(b.backNeedsConfirm()).toBe(backConfirmRule({ scene: "battle", phase }));
    }
  });

  it("training and menu never confirm", () => {
    expect(new SandboxScene().backNeedsConfirm()).toBe(false);
    expect(new MenuScene().backNeedsConfirm()).toBe(false);
  });

  it("settings, help and high scores never confirm", () => {
    expect(new SettingsScene().backNeedsConfirm()).toBe(false);
    expect(new HelpScene().backNeedsConfirm()).toBe(false);
    expect(new HighscoresScene("endless").backNeedsConfirm()).toBe(false);
  });
});

describe("back from play", () => {
  it("the back control exits to the menu", async () => {
    const p = new PlayScene(12345);
    tap(p, "back");
    expect(await opened(p)).toBe("MenuScene");
  });
});
