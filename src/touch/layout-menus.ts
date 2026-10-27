import {
  backControl,
  type Control,
  type Rect,
  type TouchCommand,
  type TouchLayout,
} from "./controls";

function rect(x: number, y: number, w: number, h: number): Rect {
  return { x, y, w, h };
}

function key(name: string): TouchCommand {
  return { kind: "key", key: name };
}

function focus(index: number): TouchCommand {
  return { kind: "focus", index };
}

function button(
  id: string,
  r: Rect,
  label: string,
  commands: TouchCommand[],
  repeat = false,
  style: "button" | "area" = "button",
): Control {
  return { id, rect: r, label, commands, repeat, style };
}

export function menuLayout(itemCount: number): TouchLayout {
  const controls: Control[] = [];
  for (let i = 0; i < itemCount; i++) {
    controls.push(
      button(
        `item:${i}`,
        rect(200, 142 + 28 * i, 240, 24),
        "",
        [focus(i), key("Enter")],
        false,
        "area",
      ),
    );
  }
  return { controls, readouts: [] };
}

export function settingsRowY(i: number): number {
  return 84 + 28 * i;
}

export function settingsLayout(rowCount: number, backPending: boolean): TouchLayout {
  const controls: Control[] = [backControl(backPending)];
  for (let i = 0; i < rowCount; i++) {
    const y = settingsRowY(i);
    controls.push(
      button(`settings:${i}:row`, rect(84, y - 4, 256, 24), "", [focus(i)], false, "area"),
      button(`settings:${i}:left`, rect(346, y - 4, 28, 24), "left", [focus(i), key("ArrowLeft")]),
      button(`settings:${i}:right`, rect(500, y - 4, 28, 24), "right", [focus(i), key("ArrowRight")]),
    );
  }
  return { controls, readouts: [] };
}

export function highscoresLayout(endless: boolean, backPending: boolean): TouchLayout {
  const controls: Control[] = [backControl(backPending)];
  if (endless) {
    controls.push(
      button("hs:left", rect(226, 58, 28, 24), "left", [key("ArrowLeft")]),
      button("hs:right", rect(386, 58, 28, 24), "right", [key("ArrowRight")]),
    );
  }
  return { controls, readouts: [] };
}

export function helpLayout(backPending: boolean): TouchLayout {
  return {
    controls: [
      backControl(backPending),
      button("help:left", rect(268, 318, 28, 24), "left", [key("ArrowLeft")]),
      button("help:right", rect(344, 318, 28, 24), "right", [key("ArrowRight")]),
    ],
    readouts: [],
  };
}

export const INITIALS_CELLS: readonly number[] = [234, 298, 362];
export const INITIALS_CELL_W = 44;

export type InitialsStep = "editing" | "confirm" | "done";

export function initialsLayout(step: InitialsStep, backPending: boolean): TouchLayout {
  if (step === "done") return { controls: [], readouts: [] };
  const controls: Control[] = [backControl(backPending)];
  if (step === "editing") {
    for (let i = 0; i < INITIALS_CELLS.length; i++) {
      const x = INITIALS_CELLS[i];
      controls.push(
        button(`slot:${i}:up`, rect(x + 8, 100, 28, 24), "up", [focus(i), key("ArrowUp")], true),
        button(`slot:${i}:letter`, rect(x, 128, INITIALS_CELL_W, 68), "", [focus(i)], false, "area"),
        button(`slot:${i}:down`, rect(x + 8, 200, 28, 24), "down", [focus(i), key("ArrowDown")], true),
      );
    }
    controls.push(button("ok", rect(288, 290, 64, 28), "OK", [key("Enter")]));
  } else {
    controls.push(
      button("ok", rect(244, 290, 64, 28), "OK", [key("Enter")]),
      button("edit", rect(332, 290, 64, 28), "EDIT", [key("Backspace")]),
    );
  }
  return { controls, readouts: [] };
}
