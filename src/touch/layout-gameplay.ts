import { backControl, type Control, type Rect, type Readout, type TouchLayout } from "./controls";
import { HUD_H, PLAYFIELD_H } from "../config";

export type GameMode = "play" | "battle" | "training";

export type GamePhase =
  | "aim"
  | "in_flight"
  | "post_shot"
  | "round_end"
  | "game_over"
  | "match_end";

export interface GameplayExtras {
  backPending: boolean;
  scored?: boolean;
  overlayLines?: number;
  previewOn?: boolean;
  fieldOn?: boolean;
}

const ROW_Y = PLAYFIELD_H + 6;
const ROW_H = HUD_H - 12;
const LINE_H = ROW_H / 2;
const BOTTOM_Y = ROW_Y + LINE_H;

const ANGLE_PANEL: Rect = { x: 54, y: ROW_Y, w: 104, h: ROW_H };
const POWER_PANEL: Rect = { x: 442, y: ROW_Y, w: 104, h: ROW_H };
const SLOT_X = 164;
const SLOT_W = 48;
const MID_X = 218;
const MID_W = 218;

function row(x: number, w: number): Rect {
  return { x, y: ROW_Y, w, h: ROW_H };
}

function top(x: number, w: number): Rect {
  return { x, y: ROW_Y, w, h: LINE_H };
}

function bottom(x: number, w: number): Rect {
  return { x, y: BOTTOM_Y, w, h: LINE_H };
}

function press(
  id: string,
  rect: Rect,
  label: string,
  key: string,
  style: Control["style"] = "button",
  repeat = false,
  lit?: boolean,
): Control {
  const base: Control = { id, rect, label, commands: [{ kind: "key", key }], repeat, style };
  return lit === undefined ? base : { ...base, lit };
}

function readout(
  id: string,
  rect: Rect,
  size: number,
  maxChars: number,
  align: Readout["align"],
  bold: boolean,
): Readout {
  return { id, rect, size, maxChars, align, bold };
}

function middleReadouts(mode: GameMode, phase: GamePhase): Readout[] {
  if (mode === "play") {
    return [
      readout("score", top(MID_X, MID_W), 12, 12, "center", true),
      readout("info", bottom(MID_X, MID_W), 11, 24, "center", false),
    ];
  }
  if (mode === "battle") {
    return [
      readout("p1_name", top(218, 80), 11, 10, "left", true),
      readout("p1_info", bottom(218, 80), 11, 10, "left", false),
      readout("round_label", top(298, 58), 10, 5, "center", false),
      readout("round_value", bottom(298, 58), 11, 5, "center", true),
      readout("p2_name", top(356, 80), 11, 10, "right", true),
      readout("p2_info", bottom(356, 80), 11, 10, "right", false),
    ];
  }
  return phase === "aim" ? [] : [readout("level", row(MID_X, MID_W), 12, 3, "center", true)];
}

export function gameplayLayout(
  mode: GameMode,
  phase: GamePhase,
  extras: GameplayExtras,
): TouchLayout {
  const controls: Control[] = [backControl(extras.backPending, row(6, 42))];
  const readouts: Readout[] = [
    readout("angle", row(86, 40), 12, 5, "center", true),
    readout("power", row(474, 40), 12, 4, "center", true),
    ...middleReadouts(mode, phase),
  ];
  const panels: Rect[] = [ANGLE_PANEL, POWER_PANEL];

  if (phase === "aim") {
    controls.push(
      press("rot_ccw", row(54, 32), "rot_ccw", "ArrowLeft", "segment", true),
      press("rot_cw", row(126, 32), "rot_cw", "ArrowRight", "segment", true),
      press("pwr_down", row(442, 32), "minus", "ArrowDown", "segment", true),
      press("pwr_up", row(514, 32), "plus", "ArrowUp", "segment", true),
      press("fire", row(552, 82), "FIRE", " ", "primary"),
    );
    if (mode === "play") {
      controls.push(press("reset", row(SLOT_X, SLOT_W), "RESET", "r"));
    }
    if (mode === "training") {
      readouts.push(readout("level", row(SLOT_X, SLOT_W), 12, 3, "center", true));
      controls.push(
        press("new_map", row(218, 50), "NEW MAP", "n"),
        press("next_map", row(272, 52), "NEXT MAP", "l"),
        press("preview", row(328, 52), "PREVIEW", "t", "button", false, extras.previewOn === true),
        press("field", row(384, 52), "FIELD", "g", "button", false, extras.fieldOn === true),
      );
    }
  } else if (phase === "in_flight") {
    controls.push(press("abort", row(SLOT_X, SLOT_W), "ABORT", "a"));
  } else if (phase === "post_shot") {
    if (mode === "play" && extras.scored === true) {
      const y = 100 + 16 * (extras.overlayLines ?? 4) + 8;
      controls.push(press("continue", { x: 272, y, w: 96, h: 24 }, "CONTINUE", "Enter"));
    }
  } else if (phase === "game_over") {
    controls.push(press("menu", { x: 280, y: 192, w: 80, h: 24 }, "MENU", "Enter"));
  } else if (phase === "match_end") {
    controls.push(press("menu", { x: 280, y: 284, w: 80, h: 24 }, "MENU", "Enter"));
  }

  return { controls, readouts, panels };
}
