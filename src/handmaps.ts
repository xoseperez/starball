// Hand-authored maps for early playtesting and procgen fallback.

import { HUD_H } from "./config";
import {
  type GameMap,
  newGoal,
  newLauncher,
  type Star,
} from "./entities";

function m(
  level: number,
  launcher: [number, number],
  goal: [number, number],
  stars: Array<[number, number, Star["starType"]]>,
  radius = 14,
): GameMap {
  return {
    launcher: newLauncher(launcher[0], launcher[1], 30, 55),
    goal: newGoal(goal[0], goal[1], radius),
    stars: stars.map(([x, y, t]) => ({ x, y, starType: t })),
    seed: 0,
    level,
  };
}

export const HANDMAPS: readonly GameMap[] = [
  // Level 1: one obstacle, straight-line works.
  m(1, [40, HUD_H + 180], [600, HUD_H + 180], [[320, HUD_H + 250, "brown_dwarf"]]),
  // Level 2: two stars, deflection helpful.
  m(2, [40, HUD_H + 220], [600, HUD_H + 80], [
    [220, HUD_H + 160, "standard"],
    [420, HUD_H + 240, "brown_dwarf"],
  ]),
  // Level 3: red giant.
  m(3, [40, HUD_H + 100], [600, HUD_H + 240], [
    [260, HUD_H + 200, "red_giant"],
    [450, HUD_H + 100, "standard"],
  ]),
  // Level 5: blue giant grazing path.
  m(5, [40, HUD_H + 250], [600, HUD_H + 60], [
    [240, HUD_H + 160, "blue_giant"],
    [440, HUD_H + 200, "standard"],
    [150, HUD_H + 60, "brown_dwarf"],
  ], 12),
  // Level 7: black hole hazard.
  m(7, [40, HUD_H + 60], [600, HUD_H + 260], [
    [300, HUD_H + 160, "black_hole"],
    [170, HUD_H + 240, "standard"],
    [480, HUD_H + 100, "brown_dwarf"],
    [520, HUD_H + 230, "red_giant"],
  ], 10),
];

export function fallbackForLevel(level: number): GameMap {
  let best = HANDMAPS[0];
  for (const map of HANDMAPS) {
    if (map.level <= level && map.level > best.level) best = map;
  }
  return best;
}
