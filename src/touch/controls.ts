import { contains, type Rect } from "./geometry";

export type { Rect } from "./geometry";

export type TouchCommand =
  | { kind: "key"; key: string }
  | { kind: "focus"; index: number }
  | { kind: "back" };

export type Icon =
  | "rot_ccw"
  | "rot_cw"
  | "minus"
  | "plus"
  | "up"
  | "down"
  | "left"
  | "right";

export const ICONS: readonly Icon[] = [
  "rot_ccw",
  "rot_cw",
  "minus",
  "plus",
  "up",
  "down",
  "left",
  "right",
];

export function isIcon(label: string): label is Icon {
  return (ICONS as readonly string[]).includes(label);
}

export interface Control {
  id: string;
  rect: Rect;
  label: string;
  commands: TouchCommand[];
  repeat: boolean;
  style: "button" | "area" | "segment" | "primary";
  lit?: boolean;
}

export interface Readout {
  id: string;
  rect: Rect;
  size: number;
  maxChars: number;
  align: "left" | "center" | "right";
  bold: boolean;
}

export interface TouchLayout {
  controls: Control[];
  readouts: Readout[];
  panels?: Rect[];
}

export interface TouchContext {
  backPending: boolean;
  device: boolean;
}

export interface Emit {
  commands: TouchCommand[];
  coarse: boolean;
}

export const BACK_RECT: Rect = { x: 4, y: 8, w: 40, h: 24 };

export const EMPTY_LAYOUT: TouchLayout = { controls: [], readouts: [] };

export function backControl(pending: boolean, rect: Rect = BACK_RECT): Control {
  return {
    id: "back",
    rect,
    label: pending ? "QUIT?" : "BACK",
    commands: [{ kind: "back" }],
    repeat: false,
    style: "button",
    lit: pending,
  };
}

export function findControl(layout: TouchLayout, x: number, y: number): Control | null {
  for (const control of layout.controls) {
    if (contains(control.rect, x, y)) return control;
  }
  return null;
}

export function controlById(layout: TouchLayout, id: string): Control | null {
  return layout.controls.find((control) => control.id === id) ?? null;
}
