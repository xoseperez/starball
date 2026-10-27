import type { TouchLayout } from "./controls";

export type RequiredAction = { key: string } | { focus: true };

const F: RequiredAction = { focus: true };
const k = (key: string): RequiredAction => ({ key });

export const REQUIRED_ACTIONS: Record<string, RequiredAction[]> = {
  "menu": [F, k("Enter")],
  "settings": [F, k("ArrowLeft"), k("ArrowRight"), k("Escape")],
  "highscores.endless": [k("ArrowLeft"), k("ArrowRight"), k("Escape")],
  "highscores.battle": [k("Escape")],
  "help": [k("ArrowLeft"), k("ArrowRight"), k("Escape")],
  "initials.editing": [
    k("ArrowUp"),
    k("ArrowDown"),
    F,
    k("Enter"),
    k("Escape"),
  ],
  "initials.confirm": [k("Enter"), k("Backspace"), k("Escape")],
  "initials.done": [],
  "play.aim": [
    k("ArrowLeft"),
    k("ArrowRight"),
    k("ArrowUp"),
    k("ArrowDown"),
    k(" "),
    k("r"),
    k("Escape"),
  ],
  "play.in_flight": [k("a"), k("Escape")],
  "play.post_shot_scored": [k("Enter"), k("Escape")],
  "play.post_shot_other": [k("Escape")],
  "play.game_over": [k("Enter"), k("Escape")],
  "battle.aim": [
    k("ArrowLeft"),
    k("ArrowRight"),
    k("ArrowUp"),
    k("ArrowDown"),
    k(" "),
    k("Escape"),
  ],
  "battle.in_flight": [k("a"), k("Escape")],
  "battle.post_shot": [k("Escape")],
  "battle.round_end": [k("Escape")],
  "battle.match_end": [k("Enter"), k("Escape")],
  "training.aim": [
    k("ArrowLeft"),
    k("ArrowRight"),
    k("ArrowUp"),
    k("ArrowDown"),
    k(" "),
    k("n"),
    k("l"),
    k("t"),
    k("g"),
    k("Escape"),
  ],
  "training.in_flight": [k("a"), k("Escape")],
};

export function covers(layout: TouchLayout, action: RequiredAction): boolean {
  for (const control of layout.controls) {
    for (const command of control.commands) {
      if ("focus" in action) {
        if (command.kind === "focus") return true;
      } else if (command.kind === "key" && command.key === action.key) {
        return true;
      } else if (action.key === "Escape" && command.kind === "back") {
        return true;
      }
    }
  }
  return false;
}
